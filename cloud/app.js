// Initialize Express in Cloud Code
var express = require('express');
var expressLayouts = require('cloud/express-layouts');
var app = express();

// Global app configuration section
app.set('views', 'cloud/views');  // Specify the folder to find templates
app.set('view engine', 'ejs'); // Set the template engine
app.use(expressLayouts);
app.use(express.bodyParser()); // Middleware for reading request body

app.get('/', function (req, res) {
  res.render('welcome');
});

app.get('/login', function(req, res) {
  res.render('login', { message: 'Welcome to Lovoy!' });
});

app.get('/dashboard', function (req, res) {
  res.render('events');
});

app.post('/login', function (req, res) {
  // POST http://example.parseapp.com/test (with request body "message=hello")
  Parse.User.logIn(req.body.username, req.body.password).then(function(user) {
      res.redirect('/dashboard');
      var EventItem = Parse.Object.extend('Event');
      var query = new Parse.Query(EventItem);
      query.equalTo('createBy',req.body.username);
      query.descending('createdAt');
      query.find({
        success: function(results) {
          alert(results);
        },
        error: function(error) {
        //Error Callback
        }
      });
    }, function(error) {
      res.send('error');
    });
});

app.post('/addEvent', function (req, res) {
  var EventItem = Parse.Object.extend('Event');
  var eventItem = new EventItem();
  eventItem.set('eventName', req.body.eventName);
  eventItem.set('eventDescription', req.body.eventDescription);
  eventItem.save(null, {
    success: function() {
      //alert('success!');
    },
    error: function() {}
  });
});

app.get('/signup', function(req,res) {
  res.render('signup');
});

app.post('/signup', function (req, res) {
  var user = new Parse.User();
  user.set('username', req.body.username);
  user.set('password', req.body.password);
  user.set('email', req.body.email);
  user.signUp(null, {
    success: function (user) {

      //var OrgProfile = Parse.Object.extend('OrgProfile');
      //var orgProf = new OrgProfile();
      ////var orgProfACL = new Parse.ACL();
      ////orgProfACL.setPublicReadAccess(true);
      ////orgProfACL.setPublicWriteAccess(false);
      ////orgProfACL.setWriteAccess(Parse.User.current(), true);
      ////orgProf.setACL(orgProfACL);

      //orgProf.set(orgName, 'UCSD');
      ////orgProf.set('createBy', Parse.User.current());
      //orgProf.save();
      //res.send('Success create user: ' + req.body.username);
      res.redirect('/dashboard');
    },
    error: function(user, error) {
      // alert('Error: ' + error.code + ' ' + error.message);
      res.send('Error: ' + error.code + ' ' + error.message);
    }
  });
});

// Logs out the user
app.post('/logout', function(req, res) {
  Parse.User.logOut();
  res.redirect('/');
});
  
// Attach the Express app to Cloud Code.
app.listen();
