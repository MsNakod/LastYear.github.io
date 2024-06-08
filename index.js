import express from "express";
import bodyParser from "body-parser";
import session from 'express-session';
import mysql from 'mysql';
import qr from 'qrcode';

const app = express();
const port = 3000;

app.use(session({
  secret: '123456',
  resave: true,
  saveUninitialized: true
}));


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'nikhilsn123',
  database: 'bus_passport'
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('MySQL Connected');
});

// ... (Your other routes for CRUD operations)

// Route to render the home page after successful login
app.get('/', (req, res) => {
  // Check if the user is logged in
  if (req.session.user) {
    const username = req.session.user;
    
    console.log(username);
    // Check if the user exists in the database
    const userExistQuery = 'SELECT * FROM pass_data WHERE username = ?';
    db.query(userExistQuery, [username],async (err, userResults) => {
      if (err) {
        console.error('Error executing user existence query:', err);
        res.render('user_home', { user: req.session.user, status: 'Error' });
        return;
      }

      if (userResults.length > 0) {
        // Assuming the expiryDate is stored in the results
        let expiryDate;
        const today = new Date();
        req.session.history = [];
        for(let i=0;i<userResults.length;i++)
        {
          expiryDate = new Date(userResults[i].valid_between);
          req.session.history.push({username,exp:expiryDate});
        }
        req.session.exp=expiryDate;
        if (today <= expiryDate) {
          const userInputData = {
            username,
            fName: req.session.fName,
            lName: req.session.lName,
            dept: req.session.dept,
            year: req.session.year,
            passExpiryDate: req.session.exp
            // Add other user data as needed
        };
          const qrCodeData = await generateQRCode(userInputData);
          res.render('user_home', { user: req.session.user, status: 'Active',qrCodeData,history:req.session.history});
        } else {
          res.render('user_home', { user: req.session.user, status: 'Inactive', history:req.session.history});
        }
      } else {
        // No record found for the given username
        console.log('No record found for the user:', username);
        res.render('user_home', { user: req.session.user, status:'',history:req.session.history});
      }
    });
  } else {
    res.redirect('/login');
  }
});

async function generateQRCode(data) {
  try {
    // Generate QR code as a data URL
    const qrCodeImage = await qr.toDataURL(JSON.stringify(data));
    return qrCodeImage;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Route to render the login page
app.get('/login', (req, res) => {
  res.render('login', { message: '' });
});

app.get('/signup', (req, res) => {
  res.render('sign_up', { message: '' });
});

app.post('/signup', (req, res) => {
  const { username, password ,fName, lName, dept, year } = req.body;

  const insertUserQuery = 'INSERT INTO users (username, password) VALUES (?, ?)';
  db.query(insertUserQuery, [username, password], (err, result) => {
    if (err) {
      // Handle error (e.g., duplicate username)
      return res.render('sign_up', { message: 'Signup failed. Please try again.' });
    }

    // Insert into 'userdata' table
    const insertUserDataQuery = 'INSERT INTO user_data (username, fName, lName, dept, year) VALUES (?, ?, ?, ?, ?)';
    db.query(insertUserDataQuery, [username, fName, lName, dept, year], (err, result) => {
      if (err) {
        // Handle error
        return res.render('sign_up', { message: 'Signup failed. Please try again.' });
      }

      // Signup successful, redirect to login
      res.redirect('/login');
    });
  });
});

// Route to handle login form submission
app.post('/login', (req, res) => {
  const { username, password} = req.body;
  const selectQuery = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(selectQuery, [username, password], (err, result) => {
    if (err) throw err;
    
    if (result.length > 0) {
      // Authentication successful, create a session
      req.session.user = username;
      const selectQuery = 'SELECT * FROM user_data WHERE username = ?';
      db.query(selectQuery, [username], (err, result) => {
        if (err) throw err;
        
        if (result.length > 0) {
          // Authentication successful, create a session
        req.session.fName=result[0].fname;
        req.session.lName=result[0].lname;
        req.session.dept=result[0].dept;
        req.session.year=result[0].year;
        console.log(result);
        } 
        
      res.redirect('/');
      });
    } else {
      // Authentication failed
      res.render('login', { message: 'Invalid username or password' });
    }
  });
});

app.get('/logout',(req,res)=>
{
  req.session.destroy();
  res.redirect('/login');
});

app.post('/profile', (req, res) => {
  // Check if the user is authenticated (logged in)
  if (req.session.user) {
    // Retrieve user information from the database or session
    const user = {
      username: req.session.user,
      fName: req.session.fName,
      lName: req.session.lName,
      dept : req.session.dept,
      year : req.session.year,
      // Fetch other user-specific data as needed from the database
    };
    console.log(user);

    // Render the profile page with user information
    res.render('profile', { user });
  } else {
    // User is not logged in, redirect to the login page
    res.redirect('/login');
  }
});

app.post('/passport', (req, res) => {
    const username=req.session.user ;
    console.log(username);
    res.render("passport",{username});
});

app.post('/new_user',(req,res)=>
{
    const username=req.session.user ;
    const userInputData = {
        username,
        fName: req.session.fName,
        lName: req.session.lName,
        dept: req.session.dept,
        year: req.session.year
        // Add other user data as needed
    };
    req.session.activationDate = new Date();
    const activationDate = new Date(req.session.activationDate);
    const valid_between = new Date(activationDate);
    valid_between.setMonth(valid_between.getMonth() + 1);
  
    req.session.exp= valid_between;
    const Un= 'INSERT INTO pass_data(username, valid_between) VALUES (?, ?)';
    db.query(Un, [username, valid_between], (error, results) => {
      if (error) {
        console.error('Error inserting activation data:', error);
        res.send('Error activating user.');
      } else {
        console.log('User activated successfully.');
        
        res.redirect("/");
      }
    });
});
 

app.get('/admin_login',(req,res)=>
{
  res.render('admin.ejs');
});

app.post('/admin_login',(req,res)=>
{
  let admin_name="sn";
  let pwd="1234";
  let enteredAdminName = req.body.username;
  let enteredPwd = req.body.password;
  
  console.log(admin_name,"->",pwd);
  console.log(enteredAdminName,"->",enteredPwd);
  if (enteredAdminName === admin_name && enteredPwd === pwd) {
      // Authentication successful
      req.session.admin_name = admin_name;
      req.session.pwd = pwd;
      res.render('admin_dashboard.ejs'); // Redirect to admin dashboard or any other route
  } else {
      // Authentication failed
      res.render('admin.ejs', { error: 'Invalid username or password' });
  }
});
// ... (Other routes)
app.post('/forgotpassword', (req, res) => {
  
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// const app = express();
// const port = 3000;

// app.use(bodyParser.urlencoded({ extended: true }));


// // Set EJS as the view engine
// app.set('view engine', 'ejs');

// // Serve static files from the 'public' directory
// app.use(express.static('public'));

// // Set up MySQL connection
// const mysql = require('mysql');
// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: 'nikhilsn123',
//   database: 'bus_passport',
// });

// // Connect to MySQL
// db.connect((err) => {
//   if (err) {
//     throw err;
//   }
//   console.log('MySQL Connected');
// });

// app.get("/", (req, res) => {
//   res.render("index.ejs");
// });

// app.post("/", (req, res) => {
//   res.render("user_home.ejs");
// });

// app.post("/profile", (req, res) => {
//   res.render("profile.ejs");
// });

// app.post("/passport", (req, res) => {
//   res.render("passport.ejs");
// });

// app.post("/success", (req, res) => {
//   res.render("suuccess.ejs");
// });

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });