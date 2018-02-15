const json2html = require("node-json2html")

let regroupReports = (jsons) => {
    let groupedByScope = jsons.reduce((acc, report) => {
        let scopes = report.body["scopes"]
        Object.keys(scopes).forEach(scopeKey => {
            let slices = scopes[scopeKey]["slices"].reduce((acc1, slice) => {
                acc1[slice["name"]] = slice
                return acc1
            }, {})
            if (acc[scopeKey] === undefined) {
                acc[scopeKey] = {}
            }

            acc[scopeKey][report["header"]] = slices
        })
        return acc

    }, {})

    return groupedByScope
}

let parseReports = (reports) => {
    let updatedReports = regroupReports(reports)
    return Object.keys(updatedReports).map(r => {
        const SLICES_COLUMN = "Slices"

        let content = updatedReports[r]
        var plainHeaders = Object.keys(content).sort((a,b) => a < b)
        plainHeaders.unshift(SLICES_COLUMN)

        let headers = plainHeaders.map(h => { return { "header": h } })
        var allRows = Object.keys(plainHeaders.reduce((rows, h) => {
            if (h !== SLICES_COLUMN) {
                Object.keys(content[h]).forEach(e => rows[e] = "") // collect all possible rows
            }
            return rows
        }, {})).sort()

        var rows = allRows.map(r => {
            return {
                "row": plainHeaders.map((h, i) => {
                    if (h === SLICES_COLUMN) {
                        return {
                            "value": r
                        }
                    } else if (content[h][r] === undefined) {
                        return {
                            "value": "-"
                        }
                    }

                    let prevHeader = plainHeaders[(i + 1 < plainHeaders.length) ? (i + 1) : i]
                    let rowCurrentValue = content[h][r]["totalGas"]
                    let rowPreviousValue = (content[prevHeader][r] || content[h][r])["totalGas"]
                    let diff = rowCurrentValue - rowPreviousValue
                    let diffPercent = diff / rowPreviousValue * 100

                    return {
                        "value": rowCurrentValue,
                        "sign": diff,
                        "percent": diffPercent.toFixed(1)
                    }
                })
            }
        })

        return {
            "scopeName": r,
            "content": {
                "header": headers,
                "rows": rows
            }
        }
    })
}


let transforms = {
    "parent": { "<>": "div", "html": function() {
        return `
        ${json2html.transform(this, transforms.header)}
        ${json2html.transform(this.content, transforms.table)}
        <hr>
        `
    }},
    "header": { "<>": "h2", "html": "${scopeName}" },
    "tableHeader": { "<>": "tr", "html": function() {
        return json2html.transform(this.header, transforms.tableHeaderRow)
    }},
    "tableHeaderRow": { "<>": "th", "html": "${header}" },
    "tableRow": { "<>": "tr", "html": function() {
        return json2html.transform(this.row, transforms.tableDataRow)
    }},
    "tableDataRow": { "<>": "td", "html": function(obj, idx) {
        if (obj.sign === undefined) {
            return json2html.transform(this, transforms._tableDataRow0Formatted)
        }

        if (obj.sign < 0) {
            obj.trend = "optimized"
            obj.trendDiff = "optimized-diff"
        } else if (obj.sign > 0) {
            obj.trend = "decreased"
            obj.trendDiff = "decreased-diff"
        } else {
            obj.trend = "neutral"
            obj.trendDiff = "neutral-diff"
        }
        return json2html.transform(obj, transforms._tableDataRowFormatted)
    }},
    "_tableDataRowFormatted": { "<>": "div", "html": "<span class=\"${trend}\">${value}</span><span class=\"${trendDiff}\">${sign} (${percent}%)</span>" },
    "_tableDataRow0Formatted": { "<>": "div", "html": "${value}" },
    "table": { "<>": "table", "html": function() {
        var content = `
        <thead>
        ${json2html.transform(this, transforms.tableHeader)}
        </thead>
        <tbody>
        ${json2html.transform(this.rows, transforms.tableRow)}
        </tbody>
        `
        return content
    }}
}

module.exports = transforms
module.exports.transformReports = (reports) => {
    let content = parseReports(reports)
    return json2html.transform(content, transforms.parent)
}
