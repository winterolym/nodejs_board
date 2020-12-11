var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var flash = require('connect-flash');
var session = require('express-session');
var passport = require('./config/passport');
var client = require('redis').createClient(process.env.REDIS_URL);

var app = express();

// Config
require('dotenv').config();
var MySecret = process.env.SECRET_KEY;

// DB setting
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);
mongoose.connect(process.env.MONGO_DB_URI);
var db = mongoose.connection;
db.once('open', function(){
  console.log('DB connected');
});
db.on('error', function(err){
  console.log('DB ERROR : ', err);
});

// Other settings
app.set('view engine', 'ejs');
app.use(express.static(__dirname+'/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride('_method'));
app.use(flash());
app.use(session({
  cookie:{                // Use Cookies
    secure: true,
    maxAge:60000
  },
  store: new RedisStore({
    url: "https://gaon-bulletin-board.herokuapp.com/",
    port: 3000,
    client: client,
    prefix : "session:",
    db : 0
  }),
  secret:MySecret,
  resave:true,
  saveUninitialized:true
}));

app.use(function(req,res,next){
if(!req.session){
    return next(new Error('Oh no')); //handle error
}
next(); //otherwise continue
});

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Custom Middlewares
app.use(function(req,res,next){
  res.locals.isAuthenticated = req.isAuthenticated();
  res.locals.currentUser = req.user;
  next();
});

// Routes
app.use('/', require('./routes/home'));
app.use('/posts', require('./routes/posts'));
app.use('/users', require('./routes/users'));

// Port setting
var port = 3000;
app.listen(port, function(){
  console.log('server on! http://localhost:'+port);
});
