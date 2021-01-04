const System = Java.type('java.lang.System');
const InetAddress = Java.type('java.net.InetAddress');
const FileSystems = Java.type('java.nio.file.FileSystems');
const StandardWatchEventKinds = Java.type('java.nio.file.StandardWatchEventKinds');
const InetSocketAddress = Java.type('java.net.InetSocketAddress');
const ProcessBuilder = Java.type('java.lang.ProcessBuilder');

module.exports = (utils) => {

    Object.defineProperty(utils, 'platform', {
        get: () => {
            let platform = System.getProperty("os.name");
            platform = ({ 'win32' : 'windows' }[platform]) || platform;
            let arch = System.getProperty("os.arch");
            return `${platform}-${arch}`;
        }
    });

    utils.argv = vertx.getOrCreateContext().processArgs();

    utils.spawn = (file, args, options = {}, ready) => {
        return vertx.executeBlocking((resolve, reject) => {
            if(!options)
                options = { }

            const { env } = process;

            let pb = new ProcessBuilder(file, args);
            pb.inheritIO();
            Object.assign({ env }, options)
            Object.assign(pb.environment(), env)

            let proc = pb.start();
            let done = false;

            if(typeof ready == 'function')
                ready(proc);

            let exit = proc.waitFor();

            if (exit === 0) {
                if(!done) {
                    resolve(code);
                    done = true;
                }
            } else {
                if(!done) {
                    done = true;
                    reject(exit);
                }
            }
        });
    }

    utils.fetchJSON = (...args) => {
        return new Promise((resolve, reject) => {
            return vertx.createHttpClient().request(...args).then(res=>{
                resp.bodyHandler(body=>{
                    body.json().then(json=>{
                        resolve(json);
                    }).catch(e=>{
                        resolve({error:"JSON Parse error", JSONError:e, res})
                    })
                });
            }).catch(e=>{
                resolve({error:"URL fetch error", URLError:e})
            })
        })
    }

    utils.readJSON = (filename) => {

        try {
            if(!vertx.fileSystem().existsBlocking(filename))
                return null;
            return JSON.parse(vertx.fileSystem().readFileBlocking(filename));
        } catch(ex) {
            console.trace('readJSON error:',ex);
            return null;
        }
    }

    utils.getConfig = function(name, defaults = null) {
        let data = [ ];
        name = name.replace(/\.conf$/i,'');
        [`${name}.conf`, `${name}.${InetAddress.getLocalHost().getHostName()}.conf`, `${name}.local.conf`].forEach((filename) => {
            if(vertx.fileSystem().existsBlocking(filename))
                data.push(vertx.fileSystem().readFileBlocking(filename) || null);
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
        let watchService = FileSystems.getDefault().newWatchService();
        let path = Paths.get(filename);
        path.getParent().register(
            watchService,
            StandardWatchEventKinds.ENTRY_CREATE,
            StandardWatchEventKinds.ENTRY_DELETE,
            StandardWatchEventKinds.ENTRY_MODIFY);
        let key;
        while ((key = watchService.take()) != null) {
            for (let evt of key.pollEvents()) {
                if (evt.context() == path.getFileName()) {
                    update();
                }
            }
            key.reset();
        }
        update();
    }

    utils.isPortReachable = async (port, host = "localhost", timeout = 1000) => {
        return vertx.executeBlocking((resolve, reject) => {
            let addr = new InetSocketAddress(host, port);
            let socket = new Socket();
            try {
                socket.connect(addr, timeout);
                socket.close()
                resolve(true);
            } catch(error) {
                resolve(false);
            }
        });
    };

}