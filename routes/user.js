var mysql 		= require("mysql");
var express 	= require('express');
var app 		= express();
var path 		= require("path");
var bcrypt = require('bcryptjs');
var numer = require('numeric');
var router = express.Router();

	var bodyParser = require('body-parser');

	app.use(bodyParser.urlencoded({ extended: true }));

    app.use(bodyParser.json());

	var cookieParser = require('cookie-parser');

	var session = require('express-session');

	router.use(session({ secret: 'app', cookie: { maxAge: 1*1000*60*60*24*365 }}));

	router.use(cookieParser());

// Inicjalizacja bazy danych 
var connection = mysql.createConnection({
    host: "jkpawlowski.nazwa.pl",

    port: 3306,

    user: USER,

    password: PASS,

    database: DB
});
router.use(express.static("../public"));

 //odnosniki 
router.get('/', function(req, res) {
	addRouteInfo(req);
	console.log(req.session.routerInfo);
	res.render("pages/home", {req: req.session.ID});
});

router.get('/ui', function (req, res) {
    res.render('pages/ui', { req: req.session.ID });
})

router.get('/ui_results', function (req, res) {
    res.render('pages/ui_results', { req: req.session.ID });
})
router.post('/ui_results', function (req, res) {
    //dietResult(req, res, '');
})
router.post('/ui', function (req, res) {
    dietResult(req, res, '');
})
//logowania
router.get('/loginPage', function(req,res) {
	res.render("pages/login", {req: req.session.ID});
});


// rejestracji
router.get('/registerPage', function(req,res) {
	res.render('pages/register', {req: req.session.ID});
})

router.post('/register', function(req,res) {

    if (req.body.UserName == '' || req.body.Password == '') {
		res.render('pages/register', {req: req.session.ID, noInput: true})
	}
	else {
		bcrypt.genSalt(10, function(err, salt) {
			bcrypt.hash(req.body.Password, salt, function(err, p_hash) {
				
				connection.query('INSERT INTO Users (UserName, Password) VALUES (?, ?)', [req.body.UserName, p_hash], function (error, results, fields) {
					
                    // unikatowy login
                    if (error) res.render('pages/register', { req: req.session.ID, error: true });
					else res.render('pages/login', {req: req.session.ID});
				});
			});
		});
	}
});

router.post('/login', function(req,res) {
	loginAuth(req, res, '')	
})

//wylogowania
router.get('/logoutPage', function (req, res) {
    res.render('pages/logout', { req: req.session.ID });
})

router.post('/logout', function(req,res) {

	connection.query(query, function(error, results, fields) {
		req.session.destroy(function(err) {
			if(err) console.log(err);
			res.render('pages/logout.ejs', {req: null});
		})
	})
});
/*
router.get('/resultPage', function (req, res) {
    res.render('pages/dietresult', { req: req.session.ID });
});

router.post('/result', function (req, res) {
    dietResult(req, res, '')
})*/

function dietResult(req, res, url) {
    let lak = 3, weg = 3, glu = 3;
    console.log(req.body.laktoza);
   if (req.body.laktoza == "on") lak = 1;
   if (req.body.wegetarianizm == "on") weg = 1;
   if (req.body.bezglutenu == "on") glu = 1;



    connection.query('SELECT Ingredients.Name, Limits.Daily, Ingredients.Kcal, Ingredients.Price100 FROM Limits INNER JOIN Ingredients ON Limits.IngredientID = Ingredients.ID  WHERE (Ingredients.Gluten <> ? ) AND (Ingredients.Lactose <> ? ) AND (Ingredients.Vege <> ? ) ', [glu, lak, weg], function (error, results, fields) {
       // console.log(results);
        let produkty = [];
        let cena = [];
        let b = [];
        let lengths = results.length;
        let i = 0, j = 0;
        let nor = 2 + 2 * lengths;
        let a = new Array(nor);

       
        //zerowanie tablicy a       
       for (i = 0; i < nor; i++) {
            a[i] = new Array(lengths);
            for (j = 0; j < lengths; j++) {
                a[i][j] = 0;
            }
       }
        //podstawa tablicy a
        i = 2;
        for (j = 0; j < lengths; j++) {
            a[i][j] = -1;
            i++;
            a[i][j] = 1;
            i++;
        }
        
        //wartosci kcal do tablicy a
        for (j = 0; j < lengths; j++) {
            a[0][j] = results[j].Kcal;
        }
        for (j = 0; j < lengths; j++) {
            a[1][j] = -results[j].Kcal;
        }
        
        //ograniczenia diety do tablicy b
        let max = req.body.max_k;
        let min;
        if (req.body.min_k == null) {
            min = max - 500;
        }
        else {
            min = req.body.min_k;
        }
        b[0] = max;
        b[1] = -min;
        
        
        //dzienne ograniczenia do tablicy b
        j = 0;
        for (i = 2; i < nor; i++) {
            b.push( 0 );
            i++;
            b.push( results[j].Daily);
            j++;
        }
        
        //wstawienie listy produktow do tablicy produkty
        for (i = 0; i < lengths; i++) {
            produkty.push(results[i].Name);
        }
        
        //wstawienie ceny w tabele cena
        for (i = 0; i < lengths; i++) {
            cena.push(-results[i].Price100);
        }
       
    
     //przeliczenie
    let lp = numer.solveLP(cena, a, b);
    let solutions = numer.trunc(lp.solution, 1e-12);
    let tabresult = [];
    let z = 0;
        let cenakoncowa = 0;

    for (i = 0; i < lengths; i++) {
        if (solutions[i] > 0,05) {
            tabresult[z] = new Array(2);
            tabresult[z][0] = produkty[i];
            cenakoncowa = cenakoncowa + solutions[i] * results[i].Price100;
            tabresult[z][1] = Math.round(solutions[i] * 100 * 100)/ 100; // rounding to 2 decimal places
            z++;
        }
        }
        console.log(cenakoncowa);
        res.locals.tabresult = tabresult;
        res.render('pages/ui_results', { req: req.session.ID, tabresult: res.locals.tabresult});
    })
}


function loginAuth(req, res, url) {

    if (req.body.UserName == '') {
		
		if(url != '') {
			redirectToPostings(res, url)
		} else {
			res.render('pages/login', {req: req.session.ID, noInput: true});
		}
	} else {
		loginAuthQuery(req, res, url);
	}
}

function loginAuthQuery(req, res, url) {
	
	connection.query('SELECT * FROM Users WHERE UserName = ?', [req.body.UserName], function(error, results, fields) {
		
		if (results.length == 0 || error) {
			if(url != ''){

				redirectToPostings(res, url)
			} else {
				res.render('pages/login', {req: req.session.ID, error: true, email: true});
			}
		} else {
			
		  	bcrypt.compare(req.body.Password, results[0].Password, function(err, result) {

		  	    if (result == true) {
		  	    	req.session.ID = results[0].ID;
		  	      	req.session.UserName = results[0].UserName;
		  	      	req.session.routerInfo = [];
		  	      	req.session.logInTime = getTime();
		  	      	if(url == '') {
		  	      		addRouteInfo(req);
		  	      	} else {
		  	      		addRouteInfo(req, '/'+url);
		  	      	}
		  	      	
		  	      	res.redirect('/'+url);

		  	    } else if(url != '') {

		  	    	redirectToPostings(res, url)
                    } else {
                        res.render('pages/login', { req: req.session.UserName, error: true, email: true });
		  	    }
		  	});
		}
	});
}

module.exports = router;










