// Imports
const config = require("./config.json");
const passport = require('passport');
const multer = require('multer');
const bodyParser = require('body-parser');
const session  = require('express-session');
const express = require("express");
const flash  = require('express-flash');
const chalk = require('chalk');
const figlet = require('figlet');
const utils = require('hyperz-utils');
const pjson = require('./package.json');
const axios = require('axios');
const bcrypt = require('bcrypt');

let projectName = 'PROJECTNAME'
let storedAppVariable;
let dbcon;

// Init Function
async function init(app, con) {
    if (Number(process.version.slice(1).split(".")[0] < 16)) throw new Error(`Node.js v16 or higher is required, Discord.JS relies on this version, please update @ https://nodejs.org`);
    var multerStorage = multer.memoryStorage(); // req.body setup
    app.use(multer({ storage: multerStorage }).any()); // req.body setup
    app.use(bodyParser.urlencoded({ extended: false })); // req.body setup
    app.use(express.json()); // req.body setup
    app.use(flash()); // passport flash system for live messages
    app.use(session({ // passport session setup
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: false,
        cookie: {maxAge: 31556952000},
    }));
    app.use(passport.initialize()); // passport initialization
    app.use(passport.session()); // passport session initialization
    app.set('views', './src/views'); // setting views folder
    app.set('view engine', 'ejs'); // setting views engine
    app.use(express.static('public')); // making public folder "public"
    app.use(express.static('src/static')); // making static folder "public"
    app.use('/assets', express.static(__dirname + 'public/assets')); // creating shortcut
    app.use('/static', express.static(__dirname + 'src/static/assets')); // creating shortcut
    dbcon = con; // setting con variable for this file (MySQL Connection)
    // BEGIN FANCY CONSOLE LOGGING STUFF
    figlet.text(projectName, { font: "Standard", width: 700 }, function(err, data) {
        if(err) throw err;
        let str = `${data}\n-------------------------------------------\n${projectName} is up and running on port ${config.port}!`
        console.log(chalk.bold(chalk.blue(str)));
    });
    // Version Checking with API link above

    sqlLoop(con); // Keep SQL connection alive
    markSqlConnected(); // Mark SQL connected in console
    await resetAppLocals(app); // Reset app locals to be ready for next render (do this on every page load)
};

// Keeps settings updated for next render
async function resetAppLocals(app) {
    dbcon.query(`SELECT * FROM sitesettings`, function(err, settings) {
        if(err) throw err;
        app.locals = {
            config: config,
            packagejson: require('./package.json'),
            sitesettings: settings[0]
        };
        storedAppVariable = app;
    });
};

// Keeps SQL connection alive
async function sqlLoop(con) {
    if(con == 0) return;
    await con.ping();
    setTimeout(() => sqlLoop(con), 60000 * 30);
};

async function markSqlConnected() {
    await dbcon.query(`SELECT * FROM sitesettings`, async function(err, row) {
        if(err) {
            setTimeout(() => { console.log(`${chalk.yellow(`[SQL Manager]`)} MySQL connection failed...`); }, 3400);
        } else {
            setTimeout(() => { console.log(`${chalk.yellow(`[SQL Manager]`)} MySQL successfully connected.`); }, 3400);
        };
    });
};

async function checkAuth(req, res, next) {
    if(req.isAuthenticated()){
        dbcon.query(`SELECT * FROM users WHERE id="${req.user.id}"`, function(err, row) {
            if(err) throw err;
            if(!row[0]) {
                dbcon.query(`INSERT INTO users (id, email, password) VALUES ("${req.user.id}", "${req.user.email}", "discord")`, function(err, row) {
                    if(err) throw err;
                    next();
                });
            } else {
                next();
            };
        });
    } else{
        res.redirect("/login");
    }
};

async function checkNotAuth(req, res, next) {
    if(req.isAuthenticated()){
        res.redirect("/account");
    } else {
        next();
    };
};

async function authenticateUserLocal(username, password, done) {
    dbcon.query(`SELECT * FROM users WHERE username="${await utils.sanitize(username)}"`, async function(err, row) {
        if(err) throw err;
        if(!row[0]) return done(null, false, { message: 'No user with that username' });
        try {
            if (await bcrypt.compare(password, row[0].password)) {
              return done(null, row[0]);
            } else {
              return done(null, false, { message: 'Password incorrect' });
            };
        } catch (e) {
            return done(e);
        };
    });
};

function generateUserId(length) {
    let result           = '';
    let characters       = '0123456789';
    let date             = Date.now();
    let charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return date + result;
};



module.exports = {
    init: init,
    checkAuth: checkAuth,
    checkNotAuth: checkNotAuth,
    authenticateUserLocal: authenticateUserLocal,
    generateUserId: generateUserId,
    resetAppLocals: resetAppLocals
};
