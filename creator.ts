import * as sqlite3 from 'sqlite3';
// tslint:disable-next-line: no-var-requires
const sha = require('js-sha3')

sqlite3.verbose();

// treść quizu
const quizcont =
    [
        {
            "id": 1, // numer pytania (gdyż w każdej rundzie będzie inna kol.)
            "text": "W którym roku miała miejsce bitwa pod Poitiers?", // pytanie
            "answer": 732, // poprawna odp.
            "penalty": 30, // liczba doliczonych sekund
            "image": '../images/1.jpeg' // adres ilustracji do pytania
        },
        {
            "id": 2,
            "text": "W którym roku podpisano traktat z Verdun, skutkujący\
             rozpadem państwa Franków?",
            "answer": 843,
            "penalty": 30,
            "image": '../images/2.png'
        },
        {
            "id": 3,
            "text": "W którym roku katedra w Lincoln stała się najwyższą budowlą na świecie, przewyższając piramidę Cheopsa?",
            "answer": 1311,
            "penalty": 70,
            "image": '../images/3.jpeg'
        },
        {
            "id": 4,
            "text": "W którym roku miała miejsce Hidżra, ucieczka Mahometa z Mekki do Medyny?",
            "answer": 622,
            "penalty": 20,
            "image": '../images/4.jpg'
        },
        {
            "id": 5,
            "text": "W którym roku szlachta polska i litewska podpisały unię w Horodle?",
            "answer": 1413,
            "penalty": 50,
            "image": '../images/5.jpeg'
        },
        {
            "id": 6,
            "text": "W którym roku, według większości historyków, wielki książę kijowski Włodzimierz przyjął chrzest?",
            "answer": 988,
            "penalty": 65,
            "image": '../images/6.jpeg'
        },
        {
            "id": 7,
            "text": "W którym roku zakończyła się I wyprawa krzyżowa?",
            "answer": 1099,
            "penalty": 40,
            "image": '../images/7.jpeg'
        },
        {
            "id": 8,
            "text": "W którym roku powstał słynny zegar astronomiczny w Pradze, działający do dziś?",
            "answer": 1410,
            "penalty": 40,
            "image": '../images/8.jpeg'
        },
        {
            "id": 9,
            "text": "W którym roku powstał Uniwersytet Boloński?",
            "answer": 1088,
            "penalty": 25,
            "image": '../images/9.jpeg'
        },
        {
            "id": 10,
            "text": "W którym roku król Anglii Jan bez Ziemi wydał Wielką Kartę Swobód?",
            "answer": 1215,
            "penalty": 25,
            "image": '../images/10.jpeg'
        },
        {
            "id": 11,
            "text": "W którym roku papież Grzegorz XI, przeniósł się do Rzymu, zakończywszy niewolę awiniońską?",
            "answer": 1377,
            "penalty": 40,
            "image": '../images/11.jpeg'
        }
    ];
    const quizcont2 =
    [
        {
            "id": 1, // numer pytania (gdyż w każdej rundzie będzie inna kol.)
            "text": "十四?", // pytanie
            "answer": 14, // poprawna odp.
            "penalty": 20, // liczba doliczonych sekund
            "image": '../images2/chinesexd.png' // adres ilustracji do pytania
        },
        {
            "id": 2,
            "text": "三十七？",
            "answer": 37,
            "penalty": 20,
            "image": '../images2/chinesexd.png'
        },
        {
            "id": 3,
            "text": "六百五？",
            "answer": 605,
            "penalty": 30,
            "image": '../images2/chinesexd.png'
        },
        {
            "id": 4,
            "text": "二〇二〇？",
            "answer": 2020,
            "penalty": 40,
            "image": '../images2/chinesexd.png'
        },
    ];

const db = new sqlite3.Database('baza.db');

const seqSql = (dab:sqlite3.Database, comm:string[], next: ()=>void) => {
    if (comm.length < 1) {
        throw new Error("Too little args");
    } else if (comm.length === 1) {
        dab.run(comm[0], () => {
            next();
        })
    } else {
        dab.run(comm[0], () => {
            seqSql(dab, comm.slice(1), next);
        })
    }
};

seqSql(
    db,
    [
        'DROP TABLE questions',
        'DROP TABLE answers',
        'DROP TABLE hasla',
        'DROP TABLE quizes',
        'DROP TABLE times',
        'DROP TABLE wholeres',
        'CREATE TABLE questions (quiz_id INTEGER, q_id INTEGER, text TEXT, answer TEXT, penalty INTEGER, image TEXT, PRIMARY KEY(quiz_id, q_id))',
        'CREATE TABLE answers (user TEXT, quiz_id INTEGER, q_id INTEGER, ans INTEGER, time NUMERIC(9,2), pen NUMERIC(9,2))',
        'CREATE TABLE hasla (user TEXT PRIMARY KEY, pswd TEXT, paskey TEXT)',
        'CREATE TABLE times (user VARCHAR(48), quiz_id INTEGER, start BIGINT, stop BIGINT, PRIMARY KEY(user, quiz_id))',
        'CREATE TABLE quizes (id INTEGER PRIMARY KEY, name VARCHAR(64), description TEXT, backgroundurl TEXT)',
        'CREATE TABLE wholeres (user VARCHAR(48), quiz_id INTEGER, wholetime BIGINT, PRIMARY KEY(user, quiz_id))',
        `INSERT INTO hasla VALUES('user1', '${sha.sha3_256('user1')}', '${sha.sha3_256(new Date().toString())}')`,
        `INSERT INTO hasla VALUES('user2', '${sha.sha3_256('user2')}', '${sha.sha3_256(new Date().toString())}')`,
        `INSERT INTO quizes VALUES(1, 'Średniowieczny quiz', 'Twoim zadaniem będzie skojarzyć podane wydarzenia historyczne z okresu średniowiecza z latami, w których miały one miejsce. Możesz swobodnie przełączać się między pytaniami, ale na każde pytanie musisz udzielić odpowiedzi. Pamiętaj – musisz to zrobić jak najszybciej, a błędna odpowiedź skutkuje karą czasową!', '../images/header.png')`,
        `INSERT INTO quizes VALUES(2, 'Łatwy quiz chińskich cyfr', 'Twoim zadaniem będzie zapisać podaną w cyfrach chińskich liczbę za pomocą cyfr arabskich. Możesz swobodnie przełączać się między pytaniami, ale na każde pytanie musisz udzielić odpowiedzi. Pamiętaj – musisz to zrobić jak najszybciej, a błędna odpowiedź skutkuje karą czasową!', '../images2/header.png')`
    ],
    ()=>{
        (new Promise((resolve,reject)=>{
            let i = 0;
            quizcont.forEach(element => {
                db.run(`INSERT INTO questions VALUES(1, ${element.id}, '${element.text}', '${element.answer}', ${element.penalty},'${element.image}')`, ()=>{
                    i++;
                    if (i === quizcont.length)
                        resolve();
                })
            })
        })).then(()=>{
            (new Promise((resolve,reject)=>{
                let i = 0;
                quizcont2.forEach(element => {
                    db.run(`INSERT INTO questions VALUES(2, ${element.id}, '${element.text}', '${element.answer}', ${element.penalty},'${element.image}')`, ()=>{
                        i++;
                        if (i === quizcont2.length)
                            resolve();
                    })
                })
            })).then(()=>{db.close();
            }).catch(()=>{db.close(); throw new Error("error")})
        }).catch(()=>{db.close(); throw new Error("error")})
    }
)