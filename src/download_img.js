import * as path from "path"
import * as https from "https"


console.log(path.resolve(`.`));

const baseUrl = "https://stardewvalleywiki.com/";

const pagesUrl = "Special:AllPages?from=&to=&namespace=6";

https.get(baseUrl + pagesUrl, (res) => {

    res.setEncoding('utf8');

    let chunk = '';
    res.on("data", (data) => {
        chunk += data;
    });

    res.on("close", () => {
        console.log(chunk);
    });
});


