const os = require('os');
const fs = require('fs');
const net = require('net');
const child_process = require('child_process');
/*
const fetch = import("../../../node-fetch/src/index.js")
.catch(ex=>{
    console.error("flow-utils: node-fetch", ex)
})
*/
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = (utils) => {

    Object.defineProperty(utils, 'platform', {
        get: () => {
            let platform = os.platform();
            platform = ({ 'win32' : 'windows' }[platform]) || platform;
            let arch = os.arch();
            return `${platform}-${arch}`;
        }
    });

    utils.argv = process.argv;

    utils.spawn = (file, args, options = {}, ready) => {
        return new Promise((resolve, reject) => {

            if(!options)
                options = { }

            const { env } = process;

            let proc = child_process.spawn(file,args,Object.assign({ env }, options));
            let done = false;

            const filter = typeof options.stdout == 'function';
            proc.stdout?.on?.('data', (data) => {
                if(filter)
                    data = options.stdout(data);
                if(data)
                    process.stdout.write(data);
            });

            proc.stderr?.on?.('data', (data) => {
                if(filter)
                    data = options.stdout(data);
                if(data)
                    process.stderr.write(data);
            });

            proc.on('close', (code) => {
                if(!done) {
                    resolve(code);
                    done = true;
                }
            })

            proc.on('error', (err) => {
                if(!done) {
                    done = true;
                    reject(err);
                }
            })

            if(typeof ready == 'function')
                ready(proc);
        })
    }

    utils.fetchJSON = (...args) => {
        return new Promise((resolve, reject) => {
            fetch(...args).then(res=>{
                res.json().then(json=>{
                    resolve(json);
                }).catch(e=>{
                    resolve({error:"JSON Parse error", JSONError:e, res})
                })
            }).catch(e=>{
                resolve({error:"URL fetch error", URLError:e})
            })
        })
    }

    utils.readJSON = (filename) => {

        try {
            if(!fs.existsSync(filename))
                return null;
            return JSON.parse(fs.readFileSync(filename,{encoding:'utf8'}));
        } catch(ex) {
            console.trace('readJSON error:',ex);
            return null;
        }
    }

    utils.getConfig = function(name, defaults = null) {
        let data = [ ];
        name = name.replace(/\.conf$/i,'');
        [`${name}.conf`, `${name}.${os.hostname()}.conf`, `${name}.local.conf`].forEach((filename) => {
            if(fs.existsSync(filename))
                data.push(fs.readFileSync(filename) || null);
        })

        if(!data[0] && !data[1]) {
            return defaults;
        }

        let o = defaults || { }
        data.forEach((conf) => {
            if(!conf || !conf.toString('utf-8').length)
                return;
            let layer = eval('('+conf.toString('utf-8')+')');
            utils.mergeObjects(o, layer);
        })

        return o;
    }

    utils.watchConfig = (filename, fn) => {
        let first = true;
        const update = () => {
            try {
                let v = utils.getConfig(filename);
                fn(v, first);
                first = false;
            } catch(ex) { console.log(ex); }
        }
        fs.watch(filename, update);
        update();
    }

    utils.isPortReachable = async (port, host = "localhost", timeout = 1000) => {
        return new Promise(((resolve, reject) => {
            const socket = new net.Socket();

            const onError = () => {
                socket.destroy();
                resolve(false);
            };

            socket.setTimeout(timeout);
            socket.once('error', onError);
            socket.once('timeout', onError);

            socket.connect(port, host, () => {
                socket.end();
                resolve(true);
            });
        }));
    };

}