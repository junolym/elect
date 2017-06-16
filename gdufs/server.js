/* 使用说明： jxbhs 中填入所有要选的课程编号。然后用node启动服务，用浏览器访问并登陆教务系统 */
/* 为保证稳定运行，抢课间隔delay不能小于10 */

var superagent = require('superagent');
var querystring = require('querystring');

var host = 'http://jxgl.gdufs.edu.cn';
var browserMsg = {
    "User-Agent":"Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36",
};

var port = 16869;
require('http').createServer(server).listen(port, 'localhost');

var classNames = [ '客户关系管理', '客户关系管理',  '人力资源管理前沿讲座' ];
var jxbhs = [  201720181010106, 201720181006432, 201720181007693 ];

var jx0502zbid = '';
var delay = 100;
var refresh = 1000;
var stop = false;
var selected = {};

var us = {};
us.loginMsg = {'USERNAME': 'xuehao', 'PASSWORD': 'mima'};
us.errorMsg = {};
us.errorCount = {};
us.info = '登陆以开始选课';
us.loginFailed = 0;

function server(req, res) {

    if (req.url === '/') {
        showInfo(res);
    }

    else if (req.url === '/code') {
        getCookie(res);
    }

    else if (req.url === '/login') {
        var data = '';
        req.addListener('data', (chunk) => data += chunk)
        .addListener('end', () => {
            data = querystring.parse(data);
            login(res, data.code);
        });
    }

    else if (req.url === '/start') {
        start(res);
    }

    else if (req.url === '/stop') {
        stopAll(res);
    }

    else if (req.url === '/checkStart') {
        checkStart(res);
    }

    else if (req.url === '/result') {
        showResult(res);
    }

    else if (req.url === '/autoLoginAndStart') {
        autoLoginAndStart(res);
    }

    else if (req.url === '/set-cookie' && req.method === "POST") {
        var data = '';
        req.addListener('data', (chunk) => data += chunk)
        .addListener('end', () => {
            data = querystring.parse(data);
            if (data.cookie) {
                us.cookie = data.cookie;
            }
            res.writeHead(302, {'Location': '/'});
            res.end();
        });
    }

    else if (req.url === '/add-course') {
        var data = '';
        req.addListener('data', (chunk) => data += chunk)
        .addListener('end', () => {
            data = querystring.parse(data);
            classNames.push(data.name);
            jxbhs.push(data.id);
            res.writeHead(302, {'Location': '/'});
            res.end();
        });
    }

    else {
        res.end();
    }
}

function getCookie(res) {
    superagent.get(host + '/jsxsd/')
    .set(browserMsg)
    .end((err, sres) => {
        us.cookie = sres.header['set-cookie'];
        us.cookie = (""+us.cookie).slice(0, 43);
        getCode(res);
    });
}

function getCode(res) {
    superagent.get(host + '/jsxsd/verifycode.servlet')
    .redirects(0)
    .set(browserMsg)
    .set('Cookie', us.cookie)
    .set('Referer', 'http://jxgl.gdufs.edu.cn/jsxsd/')
    .pipe(res);
}

function login(res, code) {
    us.loginMsg['RANDOMCODE'] = code;
    if (!us.cookie) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
        res.end('先点击验证码以获取cookie');
        return;
    }
    superagent.post(host+'/jsxsd/xk/LoginToXkLdap').redirects(0)
    .set(browserMsg)
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .set('Origin', 'http://jxgl.gdufs.edu.cn')
    .set('Referer', 'http://jxgl.gdufs.edu.cn/jsxsd/')
    .set('Cookie', us.cookie)
    .send(us.loginMsg)
    .end((err, sres) => {
        if (!sres) return;
        var t = '<font color="red">';
        if (sres.text && (i = sres.text.indexOf(t)) > -1) {
            if (res) {
                res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
                // res.end(sres.text.slice(i+t.length, sres.text.indexOf('<', i+t.length)));
                res.end('验证码错误');
            }
        } else {
            // us.cookie = sres.header['set-cookie'];
            if (us.cookie) {
                getJx0502bid(res);
            } else {
                if (res) res.end('Login Failed');
            }
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
    }, 10*60*1000);  // output log every 10 mins

    var selecting = setInterval(() => {
        if (typeof(us.cookie) === 'undefined') return;
        if (stop || selected[classNames[jxbhs.indexOf(jxbh)]]) {
            clearInterval(selecting);
            clearInterval(showing);
            return;
        }

        superagent.get(host+'/jsxsd/xsxkkc/xxxkOper').redirects(0)
        .query({'jx0404id': jxbh})
        .set("Cookie", us.cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set(browserMsg)
        .timeout(1000)
        .end((err, sres) => {
            if (!sres || !sres.text) return;
            try {
                var resultJson = JSON.parse(sres.text);
                if (resultJson.success) {
                    console.log(Date() + ': ' + jxbh  + '选课成功');
                    us.errorMsg[jxbh] = '选课成功';
                    selected[classNames[jxbhs.indexOf(jxbh)]] = true;
                    clearInterval(selecting);
                    clearInterval(showing);
                } else if (resultJson.message) {
                    if (us.errorMsg[jxbh] === resultJson.message) {
                        us.errorCount[jxbh]++;
                    } else {
                        us.errorMsg[jxbh] = resultJson.message;
                        // console.log(Date() + ': ' + jxbh  + resultJson.message);
                    }
                } else {
                    // clearInterval(selecting);
                    // clearInterval(showing);
                    console.log(Date() + ': ' + '需要重新登录');
                    us.info = '需要重新登录';
                    if (us.loginFailed++ < 20) {
                        login();
                    }
                }
            } catch(e) {
                // clearInterval(selecting);
                // clearInterval(showing);
                // console.log(Date() + ': ' + '未知错误');
                // us.info = '未开放';
                var msg = '返回数据有误';
                if (us.errorMsg[jxbh] === msg) {
                    us.errorCount[jxbh]++;
                } else {
                    us.errorMsg[jxbh] = msg;
                    // console.log(Date() + ': ' + jxbh  + resultJson.message);
                }
                // console.log('Response: ', sres.text);
            }
        });
    }, jxbhs.length * delay);
}

function showInfo(res) {
    res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
    res.write('<head><title>大的的抢课</title></head>')
    res.write('<p><b>' + us.info + '</b></p>');
    for (var i in jxbhs) {
        res.write('<p>' + classNames[i] + '　：　' + (us.errorMsg[jxbhs[i]] || '未开始')
            + ' (' + (us.errorCount[jxbhs[i]] || '') + ')' + '</p>');
    }
    res.write('<form id="login" action="/login" method="POST">');
    res.write('<a target="_blank" href="/code" />验证码：</a><input name="code" />');
    res.write('<button type="submit">登录</button></form>');
    res.write('<p><a href="/start">开始</a></p>');
    res.write('<p><a href="/stop">停止</a></p>');
    res.write('<p><a href="/checkStart">等待开放并自动开始</a></p>');
    // res.write('<p><a href="/autoLoginAndStart">自动登录开始</a></p>');
    res.write('<p>Cookie: ' + us.cookie + '</p>');
    res.write('<p>jx0502zbid: ' + jx0502zbid + '</p>');
    res.write('<form id="form" action="/set-cookie" method="POST"><input name="cookie"/><button type="submit">Set Cookie</button></form>')
    res.write('<form id="form" action="/add-course" method="POST">ID: <input name="id"/>Name: <input name="name"/><button type="submit">Add course</button></form>')
    res.end('<p><a href="/result">选课结果</a></p>');
}

function showResult(res) {
    if (!us.cookie || !jx0502zbid) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
        res.end('未登录');
        return;
    }
    res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
    superagent.get(host+'/jsxsd/xsxkjg/xsxkkb')
    .set("Cookie", us.cookie).set(browserMsg).redirects(0)
    .pipe(res);
}

function getJx0502bid(res) {
    var t = 'a href="/jsxsd/xsxk/xsxk_index?jx0502zbid=';
    superagent.get(host+'/jsxsd/xsxk/xklc_list').redirects(0)
    .set("Cookie", us.cookie).set(browserMsg).redirects(0)
    .end((err, sres) => {
        if (!sres || !sres.text || sres.text.indexOf(t) == -1) {
            if (res) {
                res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
                res.end("取ID失败");
            }
            return;
        }
        var i = sres.text.indexOf(t);
        jx0502zbid = sres.text.slice(i+t.length, i+t.length+32);
        makeCookieValid(res);
    });
}

function makeCookieValid(res, startnow) {
    if (typeof(us.cookie) == 'undefined' || (!res && stop))
        return;
    var info = "";
    superagent.get(host+'/jsxsd/xsxk/xsxk_index?jx0502zbid='+jx0502zbid)
    .set("Cookie", us.cookie).set(browserMsg).redirects(0)
    .end((err, sres) => {
        if (!sres || !sres.text) return;
        // console.log(sres.text);
        if (/\/jsxsd\/xk\/LoginToXkLdap/.test(sres.text)) {
            us.info = "Cookie失效";
            if (res) {
                res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
                res.end("登陆失败");
            }
        } else if (/当前未开放选课/.test(sres.text)) {
            us.info = "未开放选课";
            if (res) {
                res.writeHead(302, {'Location': '/'});
                res.end();
            }
        } else {
            us.loginFailed = 0;
            if (startnow) {
                return start(res);
            }
            if (res) {
                us.info = "已登陆，未开始";
                res.writeHead(302, {'Location': '/'});
                res.end();
            }
        }
    });
}

function start(res) {
    if (!us.cookie && res) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
        res.end('未登录');
        return;
    }

    stop = false;
    us.info = '选课任务数： ' + jxbhs.length;
    setInterval(function() {
        makeCookieValid();
    }, refresh);

    for (var i in jxbhs) {
        (function(i) {
            setTimeout(() => {
                select(jxbhs[i]);
            }, i * delay);
        })(i);
    }

    if (res) {
        res.writeHead(302, {'Location': '/'});
        res.end();
    }
}


function stopAll(res) {
    stop = true;
    us.info = '已停止';
    if (res) {
        res.writeHead(302, {'Location': '/'});
        res.end();
    }
}

function checkStart(res) {
    if (!us.cookie && res) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
        res.end('未登录');
        return;
    }

    var checkTimes = 0;
    var checking = setInterval(() => {
        var t = 'a href="/jsxsd/xsxk/xsxk_index?jx0502zbid=';
        superagent.get(host+'/jsxsd/xsxk/xklc_list').redirects(0)
        .set("Cookie", us.cookie).set(browserMsg).redirects(0)
        .end((err, sres) => {
            if (sres && sres.text) {
                if (sres.text.indexOf(t) == -1) {
                    us.info = '等待选课开放 (' + (++checkTimes) + ')';
                    if (sres.text.indexOf('20141804592') == -1) {
                        console.log(sres.text);
                    } else if (checkTimes % 100 == 1) {
                        console.log('checking...', checkTimes);
                    }
                    return;
                }
                var i = sres.text.indexOf(t);
                jx0502zbid = sres.text.slice(i+t.length, i+t.length+32);
                makeCookieValid(undefined, true);
                clearInterval(checking);
            }
        });
    }, 500);

    if (res) {
        res.writeHead(302, {'Location': '/'});
        res.end();
    }
}

function autoLogin() {
    if (++us.loginFailed < 6) {
        console.log('Auto-logining, loginFailed: ' + us.loginFailed);
        login();
        checkStart();
    }
}

function autoLoginAndStart(res) {
    var autoCount = 0;
    var autoInterval = setInterval(() => {
        us.info = 'autoLoginAndStart: (' + (++autoCount) + ')';
        superagent.post(host+'/jsxsd/xk/LoginToXkLdap').redirects(0)
        .set(browserMsg)
        .send(us.loginMsg)
        .timeout(2000)
        .end((err, sres) => {
            if (!sres) return;
            us.cookie = sres.header['set-cookie'];
            if (us.cookie) {
                us.cookie = (""+us.cookie).slice(0, 43);
                superagent.get(host+'/jsxsd/xsxk/xsxk_index?jx0502zbid='+jx0502zbid)
                .set("Cookie", us.cookie).set(browserMsg).redirects(0)
                .end((err, sres) => {
                    if (!sres || !sres.text) return;
                    if (!/\/jsxsd\/xk\/LoginToXkLdap/.test(sres.text)) {
                        us.info = "已登陆，未开始";
                        start();
                        clearInterval(autoInterval);
                        // console.log(us.cookie);
                    } else {
                        us.info = "登陆失败";
                        us.cookie = undefined;
                    }
                });
            }
        });
    }, 1000);
    res.writeHead(302, {'Location': '/'});
    res.end();
}


console.log('Server is running');
