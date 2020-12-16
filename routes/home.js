var express = require('express');
var router = express.Router();
var passport = require('../config/passport');
var fetch = require("node-fetch");

// Home
router.get('/', function(req, res){
  fetch('http://localhost:3000/posts/getPosts')
  .then(function(res){
    return res.json();
  })
  .then(function(data) {
    returned = data;
    console.log(returned); //expecting array
    res.render('home/welcome', {posts:returned});
  })
  .catch(function(error){
    return console.log(error);
  });

});

router.get('/about', function(req, res){
  res.render('home/about');
});

// Login
router.get('/login', function (req,res) {
  var username = req.flash('username')[0];
  var errors = req.flash('errors')[0] || {};
  res.render('home/login', {
    username:username,
    errors:errors
  });
});

// Post Login
router.post('/login',
function(req,res,next){
  var errors = {};
  var isValid = true;

  if(!req.body.username){
    isValid = false;
    errors.username = 'Username is required!';
  }
  if(!req.body.password){
    isValid = false;
    errors.password = 'Password is required!';
  }

  if(isValid){
    next();
  }
  else {
    req.flash('errors',errors);
    res.redirect('/login');
  }
},
passport.authenticate('local-login', {
  successRedirect : '/posts',
  failureRedirect : '/login'
}
));

// Logout
router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

module.exports = router;
