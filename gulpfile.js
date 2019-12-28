'use strict';

// gulp = require('gulp'),
const { src, dest, task, series, parallel } = require('gulp'),
    replace = require('gulp-replace'),
    fs      = require('fs'),
    path    = require('path'),
    excel     = require('exceljs');



const regBD = ",，.。、：;；?？！!'‘’“\"”`～$¥【】「」《》()（）",
    regZHStr = `${regBD}\\u4e00-\\u9fa5\\d `,
    regVarParam = "\\+[ ]*[\\w-\\d]+[ ]*",
    regZHStrParam = `\\+[ ]*['"\`][${regZHStr}]+`,
    regPreParam = `['"\`]?[ ]*`,

    regReplace = `(?![ ${regBD}\\d\\w\\+]+)(i18n\\(')*([\\+]?[ ]*(['"\`]?)[${regZHStr}]+\\3(${regVarParam})*)+`,
    regGetParam = `(${regPreParam}${regVarParam})|(${regPreParam}${regZHStrParam})`;

let global ={
    key:{
        origin: '',
        endWith: '',
        endWithType: -1,
    }
};

const isStartYH = (str="")=>{
    return str.startsWith("'") || str.startsWith('"') || str.startsWith('`')
}
const isEndYH = (str="")=>{
    return str.endsWith("'") || str.endsWith('"') || str.endsWith('`')
}
const isEndYHKH = (str="") =>{
    return str.endsWith("')") || str.endsWith('")') || str.endsWith('`)')
}
const isEndYHDH = (str="") =>{
    return str.endsWith("',") || str.endsWith('",') || str.endsWith('`,')
}
const startFormatYH = (str="")=>{
    return "'" + (isStartYH(str) ? str.slice(1) : str);
}
const endFormatYH = (str="")=>{
    return (isEndYH(str) ? str.slice(0, -1) : str) + "'"
}
const endFormatYHKH = (str="")=>{
    return (isEndYHKH(str) ? str.slice(0, -2) : str) + "'"
}
const endFormatYHDH = (str="")=>{
    return (isEndYHDH(str) ? str.slice(0, -2) : str) + "'"
}
const endWithType = (str="")=>{
    // 0 引号结尾 1引号括号结尾
    if (isEndYH(str)){
        return 0
    }
    if(isEndYHKH(str)) {
        return 1
    }
    if(isEndYHDH(str)) {
        return 2
    }
    return -1
}
const endFormat =(str="") =>{
    let type = endWithType(str);
    global.key.endWithType = type;
    switch (type) {
        case 0:
            global.key.endsWith = `'`;
            return endFormatYH(str);
        case 1:
            global.key.endsWith = `')`;
            return endFormatYHKH(str);
        case 2:
            global.key.endsWith = `',`;
            return endFormatYHDH(str);
        case -1:
            // console.log(`key=${str},function=endFormat`)
        default :
            return str;

    }
}
const i18nKeyFormat =(str="")=>{
    return endFormat(startFormatYH(str));
}
const getParamType = (paramStr="")=>{
    // 0变量参数 1 字符串参数
    let regZH = new RegExp(`^${regPreParam}${regZHStrParam}$`),
        regVar= new RegExp(`^${regPreParam}${regVarParam}$`);

    if(regVar.test(paramStr)){
        return 0
    }
    if(regZH.test(paramStr)){
        return 1
    }
    return -1;
}
const getI18nParamsAndI18nKeyInsertVar = (i18nKey ="")=>{

    let index = 1,
        i18nParams = [],
        regGetParamFromKey = new RegExp(regGetParam, 'g');

    i18nKey = i18nKey.replace(regGetParamFromKey,function (param) {
        let tempParam,
            type = getParamType(param);

        if(!~type){
            // todo 抛错
            return null;
        }
        switch (type) {
            // 0变量参数 1 字符串参数
            case 0:
                i18nParams.push(param.split('+')[1].trim());
                return '{' + (index++) + '}';

            case 1:
                tempParam = `${param}`.split('+')[1].trim().slice(1, -1);
                return tempParam;

            default:
                // console.log("======= default key.replace =========")

        }
    })

    return {i18nKey, i18nParams};
}
const i18nStrJoinParam = (i18nKey="", i18nParamsArr =[])=>{
    i18nParamsArr.map(item=>{
        i18nKey += ", " + item
    })
    return i18nKey;
}
const i18nStrJoinEndWith = (i18nKey="")=>{
    switch (global.key.endWithType) {
        case 1:
            return i18nKey += ')';
        case 2:
            return i18nKey += ',';
        default :
            // console.log("======i18nStrJoinEndWith======")
    }
    return i18nKey + " ";
}
const addI18nIntoFile = () => {
    let fileRegReplace= new RegExp(regReplace, 'g');
    return replace(fileRegReplace, function(key, p1, offset, string) {
        // console.log(this.file.relative)

        if(/^i18n/.test(key)){
            return key
        }
        key = key.trim();
        let i18nStr="", i18nkeyAndParams="",
            {i18nKey, i18nParams} = getI18nParamsAndI18nKeyInsertVar(key);
        console.log(i18nKey);
        global.key.origin = key;
        i18nKey=i18nKeyFormat(i18nKey);
        i18nkeyAndParams = i18nStrJoinParam(i18nKey, i18nParams)

        i18nStr = 'i18n(' + i18nkeyAndParams + ')';
        i18nStr = i18nStrJoinEndWith(i18nStr)
        console.log('i18nStr===' + i18nStr)
        return i18nStr;
    })
}

const addI18n = ()=>{
    src(['build/**/*.*',
        '!build/node_modules/**/*.*',
        "!build/**/package*.json",
        "!build/**/*.md",
        "!build/**/*.lock",
        "!build/**/*.sh",
        "!build/**/gulpfile.js"])
        .pipe(addI18nIntoFile())
        .pipe(replace(/['"`]i18n\('/g, function(key, p1, offset, string) {
            return "i18n('"
        }))
        .pipe(replace(/(i18n\()+/g, function(key, p1, offset, string) {
            return "i18n("
        }))
        .pipe(dest('build-addI18n/'));
};

const addI18nWrap = async ()=>{
    console.log("addI18n===start")
    fs.existsSync("build-addI18n")? '' :fs.mkdirSync("build-addI18n");
    setTimeout(addI18n,1000*3)
    await Promise.resolve('addI18n success');
};

/*
*  替换源码中的注释 方便找i18n key
*
*/
const replaceNotes = ()=> {
    let regHtmlNotes = `<\!--[ ]*[\\w\\W\\r\\n]*?[ ]*-->`,
        regJSNotes =  `(\/{2,}.*?(\\r|\\n))|(\/(\\*)(\\n|.)*?(\\*)\/)`,
        regNotesReplace= new RegExp(`(${regHtmlNotes}|(${regJSNotes}))`, 'gmi');

    return replace(regNotesReplace, function(key, p1, offset, string) {
        // console.log("delete notes===",key)
        return "\n";
    })
}
const deleteNotes =  ()=>{
    src([projectPath + '**/*.*',
        "!" + projectPath + 'node_modules/**/*.*',
        "!" + projectPath + '**/package*.json',
        "!" + projectPath + '**/*.md',
        "!" + projectPath + '**/*.lock',
        "!" + projectPath + '**/*.sh',
        "!" + projectPath + '**/gulpfile.js'])
        .pipe(replaceNotes())
        .pipe(dest('build/'))
}
const deleteNotesWrap =async ()=>{
    console.log("deleteNotes==start")
    deleteNotes()
    console.log("deleteNotes==end")
    await Promise.resolve('deleteNotes success');
}
/*
*
* 从项目中查询i18n的key 并导出语言包(js文件)
*
* */
let filesList = [],
    isImportXls = !1,
    // 工作簿
    workbook,
    // i18n 待翻译的表格
    sheetFilename,
    worksheet;

const regGetI18nKey = `i18n\\([ ]*(.*)\\)`,
      skipArr = ['/node_modules','/assest',
          '/i18n/', '/yarn',
          'package.json', 'package-lock.json',
          '.git', '.idea', '.md', 'gulpfile.js',
          '.png', 'jpg', '.gif',
          '.css', '.less' ,'.scss'
      ];

const getFileList = (dir, filesList = []) => {
    try {
        let files = fs.readdirSync(dir);
        files.forEach((item, index) => {
            let fullPath = path.join(dir, item);
            let stat = fs.statSync(fullPath);

            let isInto = skipArr.every((item)=>{
                return !~fullPath.indexOf(item)
            })
            if (isInto && stat.isDirectory()) {
                getFileList(path.join(dir, item), filesList);
            } else {
                item[0] != '.' && isInto && stat.isFile() && filesList.push(fullPath);
            }
        });
        return filesList;

    } catch(e){
        console.log(e)
    }
}
const getI18nKeyFromFile = (path) =>{
    try {
        var fileStr = fs.readFileSync(path, "utf8"), result;
        const reg = new RegExp(regGetI18nKey, 'g');
        while ( result = reg.exec(fileStr) ) {
            let keyStr = result[1].split(/['|"|`][ ]*[,|\))]/)[0];
            writei18nKeyToFile(keyStr, path, result[0]);
        }
    }catch (e){
        console.log(e)
    }
}
const writei18nKeyToFile = (keyStr ="", path) =>{

    keyStr = "'" + keyStr.slice(1);
    keyStr =  (keyStr.endsWith('"') || keyStr.endsWith("'") ||keyStr.endsWith("`")) ? (keyStr.slice(0, -1) + "'") : (keyStr +"'") ;

    isImportXls ? writeI18nKeyTOExcel(keyStr.slice(1, -1), path) : writeI18nKeyToJS(keyStr);
}
const writeI18nKeyToJS = (keyStr)=>{
    let en_USFile = fs.readFileSync(path(__dirname, '/langs/en_US.js'), "utf8"),
        zh_CNFile = fs.readFileSync(path(__dirname, '/langs/zh_CN.js'), "utf8");

    // en_US
    !~en_USFile.indexOf(keyStr) && fs.appendFileSync('./langs/en_US.js', "    " + keyStr  + ": '',\n", 'utf8');
    // zh_CN
    ~keyStr.indexOf('{1}') && !~zh_CNFile.indexOf(keyStr) && fs.appendFileSync('./langs/zh_CN.js', "    " + keyStr+': ' + keyStr+ ',\n', 'utf8');


}
const writeI18nKeyTOExcel = (keyStr="", path="")=>{
    let isInclude = !1;
    // 迭代工作表中的所有行（包括空行）
    worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
        if(row.values[1] == keyStr){
            isInclude = !0;
        }
    });

    if(!isInclude){
        // console.log("keyStr ==",keyStr);
        path = path.slice(path.indexOf('build-addI18n')+'build-addI18n'.length);
        worksheet.addRow([keyStr, path]);
    }
}
const langsFileInit = ()=>{
    if(isImportXls){
        workbook = new excel.Workbook();
        workbook.creator = 'DHH';//设置创建者
        workbook.created = new Date();//创建时间
        workbook.modified = new Date();//修改时间

        worksheet = workbook.addWorksheet('Sheet1', {properties: {showGridLines: false}});
    } else {
        fs.writeFileSync('./langs/en_US.js','export const en_US = {\n','utf8')
        fs.writeFileSync('./langs/zh_CN.js','export const zh_CN = {\n','utf8')
    }
}
const langsFileAddEnd = ()=>{
    if(isImportXls){
        var filename= transExcelFileName + '.xlsx';//生成的文件名
        var fpath=__dirname + '/langs/'+filename;//文件存放路径
        workbook.xlsx.writeFile(fpath)//将workbook生成文件
            .then(function(res) {
                //文件生成成功后执行的操作，这里是将路径返回客户端，你可以有自己的操作
                // res.send({filePath:filename})
            });
    } else {
        fs.appendFileSync('./langs/en_US.js', '}', 'utf8');
        fs.appendFileSync('./langs/zh_CN.js', '}', 'utf8');
    }
}
const getI18nKey = async ()=> {
    fs.existsSync("langs")? '' :fs.mkdirSync("langs");
    langsFileInit();
    getFileList(path.join(__dirname, 'build-addI18n/'),filesList);
    filesList.map((filePath)=>{
        getI18nKeyFromFile(filePath)
    })
    langsFileAddEnd();

    await Promise.resolve('getI18nKey success');
}

const preGetI18nLangsXls = ()=>{
    isImportXls = !0;
    getI18nKey();
}
const preGetI18nLangsXlsWrap = async ()=>{
    fs.existsSync("langs")? '' :fs.mkdirSync("langs");
    setTimeout(preGetI18nLangsXls,1000*6);

    await Promise.resolve('preGetI18nLangsXls success');
}
// 操作项目的目录
const projectPath = "static-inside-chain/";
// 待翻译表格文件名
const transExcelFileName = "i18n";


// 删除代码中的注释代码替换为\n  缺点：链接也会被替换掉 并打包到\build
exports.deleteNotes = series(deleteNotes);

// 为源代码增加i18n 无法识别``中的${} 以及字符串的英文字母 但可以自动添加{1}{2}...拼接参数等
// 也会为注释代码增加i18n
exports.addI18n = series(addI18n);

// 从项目中查询i18n的key 并导出语言包(js文件)
exports.getI18nKeyJS = series(getI18nKey);

// 在开发前期就提前获取语言包（xlsx文件），尽可能和最终的语言包相似 （语言包中的key不包含注释）
exports.preGetI18nXlsx = series(deleteNotesWrap,addI18nWrap,preGetI18nLangsXlsWrap);
