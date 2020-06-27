import { expect } from "chai"

// import "mocha";

import {Builder, Capabilities, By, Key, ThenableWebDriver} from 'selenium-webdriver';

import { test } from "mocha";

describe('SeleniumTests', () => {
    let driver: ThenableWebDriver;

    it ('We cannot get into the quiz second time', async function() {
        this.timeout(100000);
        driver = new Builder().forBrowser("firefox").build();
        await driver.get("http://localhost:3000")
        await driver.findElement(By.name("username")).sendKeys("user1");
        await driver.findElement(By.name("password")).sendKeys("user1");
        await driver.findElement(By.id("submit")).click();
        await driver.findElement(By.id('2')).click();

        for (let i = 0; i < 4; i++) {
            await driver.findElement(By.id("answer")).sendKeys("1");
            if (i !== 3) {
                await driver.findElement(By.id("forward")).click();
            } else {
                await driver.findElement(By.id("stop")).click();
            }
        }

        await driver.get("http://localhost:3000/quiz/2");

        expect(await driver.findElement(By.id("h1")).getText()).to.include("Nie można drugi raz w ten sam quiz");
        await driver.close();
    })
    it ('After password change another sessions should log out', async function() {
        this.timeout(100000);
        driver = new Builder().forBrowser("firefox").build();
        await driver.get("http://localhost:3000");
        await driver.findElement(By.name("username")).sendKeys("user1");
        await driver.findElement(By.name("password")).sendKeys("user1");
        await driver.findElement(By.id("submit")).click();
        const session = (await driver.manage().getCookies()).slice();
        await driver.manage().deleteAllCookies();
        await driver.get("http://localhost:3000");
        await driver.findElement(By.name("username")).sendKeys("user1");
        await driver.findElement(By.name("password")).sendKeys("user1");
        await driver.findElement(By.id("submit")).click();
        await driver.findElement(By.id("change")).click();
        await driver.findElement(By.name("oldpassword")).sendKeys("user1");
        await driver.findElement(By.name("newpassword1")).sendKeys("user2");
        await driver.findElement(By.name("newpassword2")).sendKeys("user2");
        await driver.findElement(By.id("submit")).click();
        await driver.manage().deleteAllCookies();

        for (const cookie of session) {
            await driver.manage().addCookie({name:cookie.name, value:cookie.value, expiry: cookie.expiry});
        }

        await driver.get("http://localhost:3000");
        expect(await driver.findElement(By.id("errors")).getText()).to.include("Hasło zostało zmienione");
        await driver.close();
    })
    it ('Returned JSON files should have proper structure', async function(){
        this.timeout(100000);
        driver = new Builder().forBrowser("firefox").build();
        await driver.get("http://localhost:3000")
        await driver.findElement(By.name("username")).sendKeys("user2");
        await driver.findElement(By.name("password")).sendKeys("user2");
        await driver.findElement(By.id("submit")).click();
        await driver.findElement(By.id('1')).click();

        const quiz = JSON.parse(await driver.findElement(By.id("JSON")).getAttribute("innerHTML"));

        expect(quiz.length).to.equal(11);
        for (const qu of quiz) {
            expect(qu.id).to.be.a("number");
            expect(qu.text).to.be.a("string");
            expect(qu.answer).to.be.a("null");
            expect(qu.penalty).to.be.a("number");
            expect(qu.image).to.be.a("string");
        }

        for (let i = 0; i < 11; i++) {
            await driver.findElement(By.id("answer")).sendKeys("1");
            if (i !== 10) {
                await driver.findElement(By.id("forward")).click();
            } else {
                await driver.findElement(By.id("stop")).click();
            }
        }

        const result = JSON.parse(await driver.findElement(By.id("result")).getAttribute("innerHTML"));
        let sum = 0;

        expect(result.length).to.equal(11);
        for (const r of result) {
            expect(r.questionID).to.be.a("number");
            expect(r.answer).to.be.a("string");
            expect(r.time).to.be.a("number");
            sum += r.time;
        }

        expect(Number(sum.toFixed(2))).to.equal(1);
        await driver.close();
    })
})