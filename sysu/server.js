/* 使用说明： jxbhs 中填入所有要选的课程编号。然后用node启动服务，用浏览器访问并登陆教务系统 */
/* 为保证稳定运行，抢课间隔delay不能小于10 */

var superagent = require('superagent');
var querystring = require('querystring');
var md5 = require('md5');

var host = 'http://uems.sysu.edu.cn';
var browserMsg = {
    "User-Agent":"Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36",
    'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'
};

var port = 16868;
require('http').createServer(server).listen(port, 'localhost');

// pml: 62000254161001
// phone: 62000341161003
// image: 62000706161007
var jxbhs = [62000137161001];
var delay = 10;
var stop = false;

function server(req, res) {
    if (typeof(us) === 'undefined') {
        us = {};
        us.loginMsg = {};
        us.errorMsg = {};
        us.errorCount = {};
        us.info = '登陆以开始选课';
    }

    if (req.method == 'GET') {
        if (req.url === '/') {
            showInfo(res);
        }

        else if (req.url === '/login') {
            res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
            res.end(indexHtml);
        }

        else if (req.url === '/img') {
            getCookie(res);
        }

        else if (req.url === '/result') {
            showResult(res);
        }

        else if (req.url === '/stop') {
            stopSelect(res);
        }

        else {
            res.end();
        }
    }

    else if (req.method == 'POST') {
        var data = '';
        req.addListener('data', (chunk) => data += chunk)
        .addListener('end', () => {
            data = querystring.parse(data);
            login(data, res);
        });
    }
}

function getCookie(res) {
    superagent.get(host+'/elect/').redirects(0)
    .end((err, sres) => {
        us.cookie = sres.header['set-cookie'];
        getCode(res);
    });
}

function getCode(res) {
    superagent.get(host+'/elect/login/code').redirects(0)
    .set("Cookie", us.cookie)
    .pipe(res);
}

function login(data, res) {
    us.loginMsg.username = data.username;
    us.loginMsg.password = md5(data.password).toUpperCase();
    us.loginMsg.j_code = data.j_code;

    superagent.post(host+'/elect/login')
    .set("Cookie", us.cookie).set(browserMsg).send(us.loginMsg).redirects(0)
    .end((err, sres) => {

        if (typeof(sres) != 'undefined' && sres.headers && sres.headers.location) {
            var l = sres.headers.location;
            us.sid = l.slice(l.lastIndexOf('=')+1);

            // login success
            stop = false;
            us.info = '选课任务数： ' + jxbhs.length;
            // adding select tasks
            for (var i in jxbhs) {
                (function(i) {
                    setTimeout(() => {
                        select(jxbhs[i]);
                    }, i * delay);
                })(i);
            }

            res.writeHead(302, {'Location': '/'});
            res.end();

        } else {
            if (sres.text.indexOf('验证码错误') != -1) {
                us.error = '验证码错误';
            } else {
                us.error = '登录失败，用户不存在或密码错误。';
            }
            res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
            res.end(us.error);
        }
    });
}

function select(jxbh) {
    if (typeof(us.errorMsg[jxbh]) == 'undefined')
        us.errorMsg[jxbh] = '';

    if (typeof(us.errorCount[jxbh]) == 'undefined')
        us.errorCount[jxbh] = 0;

    var showing = setInterval(() => {
        console.log(Date() + ': ' + jxbh  + us.errorMsg[jxbh] + ' ('+us.errorCount[jxbh]+')');
    }, 600000);  // output log every 10 mins

    var selecting = setInterval(() => {
        if (stop) {
            clearInterval(selecting);
            clearInterval(showing);
            return;
        }

        superagent.post(host+'/elect/s/elect').redirects(0)
        .set("Cookie", us.cookie)
        .set(browserMsg)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({jxbh: jxbh, sid: us.sid})
        .end((err, sres) => {
            if (!sres || !sres.headers) return;
            if (sres.headers['content-type'] == 'text/json;charset=utf-8') {
                var errCode = JSON.parse(sres.text).err.code;
                if (errCode === 0 || errCode === 9) {
                    clearInterval(selecting);
                    clearInterval(showing);
                    console.log(Date() + ': ' + jxbh  + '选课成功');
                    us.errorMsg[jxbh] = '选课成功';
                    return;
                }

                if (us.errorMsg[jxbh] === msgs[errCode]) {
                    us.errorCount[jxbh]++;
                } else {
                    us.errorMsg[jxbh] = msgs[errCode];
                    console.log(Date() + ': ' + jxbh  + us.errorMsg[jxbh]);
                }

            } else {
                stop = true;
                clearInterval(selecting);
                clearInterval(showing);
                console.log(Date() + ': ' + 'Cookie失效，需要重新登录');
                us.info = 'Cookie失效，需要重新登录';
            }
        });
    }, jxbhs.length * delay);
}

function showInfo(res) {
    res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
    res.write('<p><b>' + us.info + '</b></p>');
    for (var i in jxbhs) {
        res.write('<p>' + jxbhs[i] + ': ' + (us.errorMsg[jxbhs[i]] || '未开始')
            + ' (' + (us.errorCount[jxbhs[i]] || '') + ')' + '</p>');
    }
    res.write('<p><a href="/login">登录并开始</a></p>');
    res.write('<p><a href="/stop">停止</a></p>');
    res.end('<p><a href="/result">选课结果</a></p>');
}

function showResult(res) {
    if (!us.cookie) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
        res.end('未登录');
        return;
    }
    superagent.get(host+'/elect/s/courseAll?xnd=2016-2017&xq=1&sid='+us.sid)
    .set("Cookie", us.cookie).set(browserMsg).redirects(0)
    .pipe(res);
}

function stopSelect(res) {
    stop = true;
    console.log(Date() + ': ' + '已停止');
    us.info = '已停止';
    res.writeHead(302, {'Location': '/'});
    res.end();
}

var msgs = [
    '提交成功。',
    '非法操作! 数据库没有对应的教学班号。',
    '当前不在此课程类别的选课时间范围内！',
    '您不在该教学班的修读对象范围内，不允许选此教学班！',
    '您所在的学生群体，在此阶段不允许对该课程类别的课进行选课、退课！',
    '系统中没有您这个学期的报到记录，不允许选课。请联系您所在院系的教务员申请补注册。',
    '您这个学期未完成评教任务，不允许选课。',
    '您不满足该教学班选课的性别要求，不能选此门课程！',
    '不允许跨校区选课！',
    '此课程已选，不能重复选择！',
    '您所选课程 的成绩为“已通过”，因此不允许再选该课，请重新选择！',
    '此类型课程已选学分总数超标',
    '此类型课程已选门数超标',
    '毕业班学生，公选学分已满，最后一个学期不允许选择公选课！',
    '您不是博雅班学生，不能选此门课程！',
    '您最多能选2门博雅班课程！',
    '您不是基础实验班学生，不能选此门课程！',
    '所选课程与已选课程上课时间冲突,请重新选择!',
    '已经超出限选人数，请选择别的课程！',
    '该教学班不参加选课，你不能选此教学班！',
    '选课等待超时',
    '您这个学期未完成缴费，不允许选课。请联系财务处帮助台（84036866 再按 3）',
    '您未满足选择该课程的先修课程条件!',
    '不在此课程类型的选课时间范围内',
    '您的核心通识课学分已满足培养方案的学分要求，无法再选择核心通识课',
    '您不是卓越班学生，不能选此门课程！'
];

var indexHtml = '<form id="form" action="/" method="POST" id="noteForm"> \
    <p>学号: <input name="username"/></p><p>密码: <input name="password" type="password"/></p> \
    <img id="code" src="/img" /><p>验证码: <input name="j_code"/></p> \
    <button type="submit">提交</button></form>';

console.log('Server is running on port: ' + port);