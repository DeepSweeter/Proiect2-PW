const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const cookieParser=require('cookie-parser');
const session = require('express-session');
const sqlite = require('sqlite3').verbose();
const app = express();
const port = 6789;
var fs = require('fs');

var db;
// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini)
app.use(express.static('public'))
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret:'appliances',
    resave:false,
    saveUninitialized:false,
    cookie:{
    maxAge:120000
    }}));
// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res
app.get('/', (req, res) =>{ 

    if(req.cookies['username']!= undefined){
        console.log(req.cookies['username']);
        fs.access(__dirname + '/cumparaturi.db', (err) =>{
            db = new sqlite.Database('cumparaturi.db')
            db.serialize(() => {
                let stmt = db.prepare('SELECT ID, NUME_PRODUS, PRET, IMAGINE FROM PRODUSE;')
                stmt.all((err, rows) => {
                    if (err) {
                        console.log(err);
                    }
                    console.log(req.cookies.rol)
                    res.render('index', { user: req.cookies.username, elemente: rows, rol: req.cookies.rol})
                })
            })
        })
        //res.render('index', {user:req.cookies['username']});
    }
    else
    {
        res.render('index', {user: undefined});
    }

});
//! Nota pentru sine: valorile cookie-urilor sunt doar string!!! 
//! Daca il setezi unul ca undefined va fi de fapt 'undefined'
//* Alternativa foloseste clearCookie pentru a il seta pe tipul de data undefined :/
app.get('/autentificare', (req , res) => {
    if(req.cookies['mesajEroare'] != undefined){
        res.render('autentificare', {mesaj:req.cookies.mesajEroare});
    }
    else{
        res.render('autentificare',{mesaj:undefined});
    }

});
// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată
var listaIntrebari;
app.get('/chestionar', (req, res) => {
    const fs = require('fs');

    fs.readFile('intrebari.json', (err, data)=>{
        if(err) throw err;
        listaIntrebari = JSON.parse(data);

        res.render('chestionar', {intrebari: listaIntrebari, user:req.cookies['username']});
    });
 
    // în fișierul views/chestionar.ejs este accesibilă variabila 'intrebari' careconține vectorul de întrebări
});


app.post('/creare-bd', (req, res) =>{
    db = new sqlite.Database('cumparaturi.db', (err) =>{
        if(err){
            console.error(err.message);
        }
        else{
        console.log('Conexiune la baza de date reusita');
        }
    });

    db.serialize(()=>{
        db.exec('CREATE TABLE IF NOT EXIST PRODUSE(\
            ID INTEGER PRIMARY KEY AUTOINCREMENT, \
            NUME_PRODUS TEXT, \
            PRET NUMBER, \
            IMAGINE TEXT);', (err) =>{
                console.log("Mesaj eroare: " + err);
                if(String(err).includes('table PRODUSE already exists')){
                    console.log("Tabelă deja creată.");
                }
            });
    });
    res.redirect('/');
});

app.post('/adaugare-cos', (req, res) =>{
    if (req.session.produse) {
		req.session.produse[req.session.produse.length] = req.body['id']
		console.log(req.session.produse);
		res.redirect('/')
	}
	else {
		req.session.produse = []
		req.session.produse[req.session.produse.length] = req.body['id']
		console.log(req.session.produse);
		res.redirect('/')
	} 

});

app.get('/vizualizare-cos', (req, res) => {
	db = new sqlite.Database('cumparaturi.db')
	db.serialize(() => {
		let stmt = db.prepare('SELECT * FROM PRODUSE;')
		stmt.all((err, rows) => {
			if (err) {
				console.log(err);
			}
			let elems = []
			rows.forEach(row => {
				if (req.session.produse) {
					if (req.session.produse.includes(String(row.ID))) {
						elems[elems.length] = row
					}
				}
			});
			// console.log(elems);
			res.render('vizualizare-cos', { username: req.cookies['utilizator'], elemente: elems })
		})
		// console.log(lista);
	})
})

app.post('/inserare-bd', (req, res) =>{
    db = new sqlite.Database('cumparaturi.db', (err) =>{
        if(err){
            console.error(err.message);
        }
    });
    var querry;
    db.serialize(()=>{
        querry = db.prepare('INSERT INTO PRODUSE(NUME_PRODUS, PRET, IMAGINE) VALUES (?, ?, ?)', ['Masina de spalat', 3200, 'public/img/masina_spalat.jpg']);
        querry.run();
        querry = db.prepare('INSERT INTO PRODUSE(NUME_PRODUS, PRET, IMAGINE) VALUES (?, ?, ?)', ['Cuptor cu microunde', 700, 'public/img/cuptor_microunde.jpg']);
        querry.run();
        querry.finalize((err)=>{
            if(err){
            console.error(err.message);
            }
            else{
                console.log('Elemente adaugate cu succes');
            }
        })
    
    })

    res.redirect('/');
});



app.post('/verificare-autentificare', (req, res) => {

    //console.log(req.body);

    var utilizatori;
    var check = false;
    fs.readFile('utilizatori.json', (err, data) =>
    {
        if(err) throw err;
        utilizatori = JSON.parse(data);
        for(var i = 0; i < utilizatori.length; ++i){
            if( req.body['username'] == utilizatori[i].utilizator && req.body['pass'] == utilizatori[i].parola){
                res.cookie('username', req.body['username']);
                session.user=req.body['username'];
                res.cookie('rol', req.body['rol']);
                session.rol=req.body['rol'];
                res.clearCookie('mesajEroare');
                check = true;               
                res.redirect('/');
                break;

            }
        }
    
        if(!check){
            res.cookie('mesajEroare', 'Eroare autentifacare: Utilizator sau parolă greșită');
            res.clearCookie('username');
            res.redirect('/autentificare');
        }
    });


});

app.post('/delogare', (req, res) =>
{
    session.user = undefined;
    //res.cookie('username', undefined);
    res.clearCookie('username');
    res.redirect('/');
});

app.post('/rezultat-chestionar', (req, res) => {
    console.log(req.body);
    var raspunsuriCorecte = 0;
    var i = 0;
    
    for(var raspuns in req.body){
        if(req.body[raspuns] == listaIntrebari[i].corect){
            raspunsuriCorecte ++;
        }
        i++;
    }
    res.render('rezultat-chestionar', {raspunsuri: raspunsuriCorecte, user:req.cookies['username']});
});
    app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:` + port));

