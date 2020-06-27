import {promisify} from 'util'
import * as sqlite3 from 'sqlite3';
import express from 'express';

export const run = (dab:sqlite3.Database) => promisify(dab.run.bind(dab));

export const beginUntilPasses = (db:sqlite3.Database, next:()=>void, fail: ()=>void) => {
    db.run('BEGIN EXCLUSIVE TRANSACTION', (err:NodeJS.ErrnoException) => {
        if (err) {
            if (err.errno === 5)
                beginUntilPasses(db, next, fail);
            else
                fail();
        } else {
            next();
        }
    })
}

export const passwordChangeError = (
     db:sqlite3.Database,
     req:express.Request,
     res:express.Response,
     msg:string
    ) => {
    db.run('ROLLBACK', () => {
        res.render('zmienhaslo2', {
            error: msg,
            csrfToken: req.csrfToken(),
            nazwa: req.body.username
        });
    });
}

export const renderError = (req:express.Request, res:express.Response, msg:string) => {
    res.render('error', {
        message: msg,
        csrfToken: req.csrfToken()
    });
}

export const internalServerError = (req:express.Request, res:express.Response) =>
     renderError(req, res, 'Internal serer error');

export const haveToLogIn = (req:express.Request, res:express.Response, next: () => void) => {
    if (!req.session.zalogowany?.username) {
        res.render('logowanie', {error: ''});
        return;
    }

    next();
}

export const sqlQuery = (
        db:sqlite3.Database,
        req:express.Request,
        res:express.Response,
        msg:string,
        next:([])=>void) => {
    db.all(msg,
        [], (err, rows) => {

        if (err) {
            internalServerError(req, res);
            return;
        }

        next(rows);
})
};

export const checkPasswordChanged = (
     db:sqlite3.Database,
     req:express.Request,
     res:express.Response,
     ok:()=>void) => {

    db.all(`SELECT paskey FROM hasla WHERE user = '${req.session.zalogowany.username}'`,
         [], (err7, rows7) => {
        if (err7) {
            internalServerError(req, res);
            return;
        }

        if (rows7[0].paskey !== req.session.zalogowany.paskey) {
            res.render('logowanie', {error: 'Hasło zostało zmienione'});
            return;
        }

        ok();
    })
}

export const isProperUsername = (name:string) => {
    for (const i of name) {
        if ((i < '0' || i > '9') && (i < 'a' || i > 'z') && (i < 'A' || i > 'Z'))
            return false;
    }
    return true;
}

export const beginExclusiveTransaction = (
     db:sqlite3.Database,
     req:express.Request,
     res:express.Response,
     next:()=>void
    ) => {

    db.run('BEGIN EXCLUSIVE TRANSACTION', [], (err:Error)=> {
        if (err) {
            internalServerError(req, res);
            return;
        };

        next();
    });
}