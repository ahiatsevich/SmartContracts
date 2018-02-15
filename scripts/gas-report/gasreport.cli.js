#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const util = require("util")
const mkdirp = require("mkdirp")
const pageTransforms = require("./json2html-report.js")
const argv = require("yargs")
    .option("output", {
        "describe": "name of the final html report"
    })
    .option("target", {
        "alias": "t",
        "describe": "target directory with json reports"
    })
    .help("help")
const jsdom = require("jsdom"), { JSDOM } = jsdom

const args = argv.argv

const config = {
    "output": path.resolve(args.output || "./docs/public/"),
    "target": path.resolve(args.target || "gas-reports")
}

const report = {
    TEMPLATE_FILENAME: "page-template.html",
    REPORT_FILENAME: "gas-cmp-report.html",
    REPORT_STYLE_FILENAME: "gas-report.css"
}

let readJsonReport = async (reportPath) => {
    let json = await util.promisify(fs.readFile)(reportPath, "utf8")
    return {
        "header": path.basename(reportPath, ".json"),
        "body": JSON.parse(json)
    }
}

let readReports = async (reportDir) => {
    let files = (await util.promisify(fs.readdir)(reportDir))
        .filter(e => path.extname(e) !== "")
        .map(e => path.join(reportDir, e))
    let jsons = await Promise.all(files.map(async (file) => await readJsonReport(file)))
    return jsons
}

let run = async () => {
    let reports = await readReports(config.target)
    let content = pageTransforms.transformReports(reports)

    const reportTemplate = await JSDOM.fromFile(path.join(__dirname, report.TEMPLATE_FILENAME))
    reportTemplate.window.document.getElementById("report").innerHTML = content
    const serializedPage = reportTemplate.serialize()

    try {
        await util.promisify(fs.open)(path.join(config.output, report.REPORT_FILENAME), "w")
    } catch (err) {
        if (err.code === 'EEXIST') {
            throw err
        }

        if (err.code === 'ENOENT') {
            await util.promisify(mkdirp)(config.output)
        }
    }

    try {
        await util.promisify(fs.writeFile)(path.join(config.output, report.REPORT_FILENAME), serializedPage)
        await util.promisify(fs.copyFile)(path.join(__dirname, report.REPORT_STYLE_FILENAME), path.join(config.output, report.REPORT_STYLE_FILENAME))
    } catch (err) {
        console.error("Error while writing html", err)
        throw err
    }
}

run().then(() => {
    console.log(`Gas report is ready at ${config.output}.`)
})
