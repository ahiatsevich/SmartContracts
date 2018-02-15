"use strict";

const pjson = require('../../package.json');
const fs = require("fs")
const path = require("path")
const util = require("util")
const mkdirp = require("mkdirp")

const DEFAULT_REPORT_DIR = "./gas-reports/"

function EconomicsLogger() {
    var _scopes = {}
    var _activeScope

    function Slice(name) {
        var _methods = []
        let _name = name

        this.addMethod = (method, tx, payload) => {
            _methods.push({
                "sig": method,
                "tx": tx.tx,
                "gas": tx.receipt.gasUsed,
                "payload": payload === undefined ? "" : payload
            })
        }

        this.toJSON = () => {
            return {
                "name": _name,
                "methods": _methods,
                "totalGas": _methods.reduce(((acc, e) => acc + e.gas), 0)
            }
        }
    }

    this.makeSlice = async (name, exec) => {
        if (exec === undefined) {
            console.error("Should pass function as a second parameter");
            throw "Have not found exec parameter";
        }

        let _slice = new Slice(name)
        await exec(_slice)
        _scopes[_activeScope]["slices"].push(_slice)
    }

    this.setScope = (scope) => {
        if (scope === undefined || scope === "") {
            throw "Invalid 'scope' argument"
        }

        _activeScope = scope
        if (_scopes[_activeScope] === undefined) {
            _scopes[_activeScope] = {
                "slices": []
            }
        }
    }


    this.toJSON = () => {
        return {
            "version": pjson.version,
            "scopes": Object.keys(_scopes).filter(key => _scopes[key]["slices"].length > 0)
            .reduce((acc, key) => {
                acc[key] = {
                        "slices": _scopes[key]["slices"].map(e => e.toJSON())
                }
                return acc
            }, {})
        }
    }

    this.setScope("default")
}

var saving = {
    shouldSave: false,
    objToSave: null,
    path: null
}

let save = async (obj, toPath = DEFAULT_REPORT_DIR) => {
    const json = JSON.stringify(obj, null, 4)

    if (path.parse(toPath).ext === "") {
        toPath = path.join(toPath, `${(new Date()).toISOString()}.json`)
    }

    toPath = path.resolve(toPath)


    try {
        await (util.promisify(fs.open))(toPath, "w")
    } catch (err) {
        if (err.code === "EEXIST") {
            console.error(`Failed trying to rewrite file ${toPath}`)
            throw err
        }

        if (err.code === "ENOENT") {
            await util.promisify(mkdirp)(path.dirname(toPath))
        }
    }

    try {
        await util.promisify(fs.writeFile)(toPath, json)
    } catch (err) {
        throw err
    }
}

let saveSync = (obj, toPath = DEFAULT_REPORT_DIR) => {
    const json = JSON.stringify(obj, null, 4)

    if (path.parse(toPath).ext === "") {
        toPath = path.join(toPath, `${(new Date()).toISOString()}.json`)
    }

    toPath = path.resolve(toPath)


    try {
        fs.openSync(toPath, "w")
    } catch (err) {
        if (err.code === "EEXIST") {
            console.error(`Failed trying to rewrite file ${toPath}`)
            throw err
        }

        if (err.code === "ENOENT") {
            mkdirp(path.dirname(toPath))
        }
    }

    try {
        fs.writeFileSync(toPath, json)
    } catch (err) {
        throw err
    }
}

let saveOnce = async (obj, toPath = DEFAULT_REPORT_DIR) => {
    saving.shouldSave = true
    saving.objToSave = obj
    saving.path = toPath
}

var exited = false
function onceOnExit() {
    if (exited) { return }
    exited = true

    if (saving.shouldSave) {
        saveSync(saving.objToSave, saving.path)
    }
}


process.on('exit', (code) => {
    onceOnExit();
    console.log(`About to exit with code: ${code}`);
});

process.on('SIGINT', () => {
    onceOnExit();
    process.exit()
});

module.exports = new EconomicsLogger()
module.exports.save = save
module.exports.saveOnce = saveOnce
module.exports.WORK_ENV = "gasreportgen"
