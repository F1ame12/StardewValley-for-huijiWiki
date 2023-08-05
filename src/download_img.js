import * as https from "https"
import * as cherrio from "cheerio"
import * as fs from "fs"
import * as path from "path"
import {
    setTimeout,
} from 'timers/promises';

// 官方wiki主站url
const BASE_URL = "https://stardewvalleywiki.com";

/**
 * 
 * @param {string} pageUrl 页面url
 * @param {boolean} isRawData 是否输出二进制数据 默认输出utf8格式字符串
 * @returns {Promise<string | Buffer>}
 */
function readRaw(pageUrl, isRawData = false) {
    let promise = new Promise((resolve, reject) => {
        const req = https.get(BASE_URL + pageUrl, (res) => {
            if (!isRawData) {
                res.setEncoding('utf8');
            }
            res.setTimeout(15000, () => {
                console.log(`连接超时 url=${pageUrl}`);
                reject(`连接超时 url=${pageUrl}`);
            });

            let buffer = null;
            res.on("data", (data) => {
                if (!buffer) {
                    buffer = Buffer.from(data);
                } else {
                    buffer = Buffer.concat([buffer, Buffer.from(data)]);
                }
            });

            res.on("error", (err) => {
                console.log(`连接异常 url=${pageUrl}`);
                reject(`连接异常 url=${pageUrl}`);
            });

            res.on("close", () => {
                if (isRawData) resolve(buffer);

                resolve(buffer.toString());
            });
        });
        req.setTimeout(15000, () => {
            console.log(`连接超时 url=${pageUrl}`);
            reject(`连接超时 url=${pageUrl}`);
        });
        req.on("error", () => {
            console.log(`连接异常 url=${pageUrl}`);
            reject(`连接异常 url=${pageUrl}`);
        });
        req.on("close", () => {
            //console.log(`连接被关闭 url=${pageUrl}`);
            //reject(`连接被关闭 url=${pageUrl}`);
        });
    });



    return promise;
}

/**
 * 
 * @param {stirng} name 
 * @returns {string}
 */
function filterFileName(name) {
    const reg = /[\<\>\?\*\|\\\/\:\"]/g;
    const res = name.replace(reg, "");
    return res;
}

function getSavePath(imgName) {
    return path.resolve('.', "./data/img/", imgName);
}

/**
 * 
 * @param {string} filePageUrl 文件页面url
 */
async function downloadImg(filePageUrl) {
    try {
        // 提取文件名 File:XXX.jpg -> XXX.jpg
        let imgName = filePageUrl.substring(filePageUrl.indexOf(":") + 1);
        imgName = decodeURIComponent(imgName);
        imgName = filterFileName(imgName);
        let savePath = getSavePath(imgName);
        if (fs.existsSync(savePath)) return;

        const pageData = await readRaw(filePageUrl);

        const $ = cherrio.load(pageData);
        const imgDOM = $('div.fullImageLink').children('a')[0];
        const imgUrl = imgDOM.attribs['href'];

        const imgData = await readRaw(imgUrl, true);

        fs.writeFile(savePath, imgData, "binary", (err) => {
            if (err) throw err;
            console.log(`文件已保存至 ${savePath}`);
        });
    } catch (error) {
        console.log(`下载 ${filePageUrl} 失败. error = ${error}`);
    }
}


async function main() {
    let pageUrls = ["/Special:AllPages?from=&to=&namespace=6"];
    while (pageUrls.length > 0) {
        const url = pageUrls.pop();

        try {
            const pageData = await readRaw(url);
            const $ = cherrio.load(pageData);
            const imgDOMs = $('ul.mw-allpages-chunk').children("li");

            const nextPageDoms = $('div.mw-allpages-nav').children('a:contains("Next page")');
            for (const dom of nextPageDoms) {
                const nextUrl = dom.attribs['href'];
                pageUrls.push(nextUrl);
                break;
            }

            console.log(`开始处理 ${url} 页面 总计 ${imgDOMs.length} 条图片`);
            let tasks = [];
            for (const l of imgDOMs) {
                const ul = l.firstChild;
                const fileUrl = ul.attribs['href'];

                let imgName = fileUrl.substring(fileUrl.indexOf(":") + 1);
                imgName = decodeURIComponent(imgName);
                const savePath = getSavePath(imgName);
                if (fs.existsSync(savePath)) {
                    console.log(`跳过存在文件 ${savePath}`);
                    continue;
                }

                console.log(`开始下载 ${fileUrl}`);
                tasks.push(downloadImg(fileUrl));
                if (tasks.length >= 10) {
                    await Promise.allSettled(tasks);
                    tasks = [];

                    console.log(await setTimeout(5000, "等待 5s 后继续尝试下载"));
                }
            }
            if (tasks.length > 0) {
                await Promise.allSettled(tasks);
                tasks = [];
            }
        } catch (error) {
            console.log(`error!!! ${error}`);
        }
    }

}

main();

