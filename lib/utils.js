const os = require('os');
const fs = require('fs');
const child_process = require('child_process');
const toString = Object.prototype.toString;

const utils = {
	get platform(){
		let platform = os.platform();
		platform = ({ 'win32' : 'windows' }[platform]) || platform;
		let arch = os.arch();
		return `${platform}-${arch}`;
	}
};

utils.isNw = typeof nw != 'undefined' && typeof nw.App != 'undefined';
utils.toString = toString;
const is = utils.is = (obj, type) => {return toString.call(obj) == '[object '+type+']'}
utils.isArray = (obj) => {return Array.isArray(obj);/*return is(obj, 'Array')*/}
utils.isObject = (obj) => {return is(obj, 'Object')}
utils.isString = (obj) => {return is(obj, 'String')}
utils.isNumber = (obj) => {return is(obj, 'Number')}
utils.isUndefined = (obj) => {return is(obj, 'Undefined')}

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

utils.match = (text, regexp) => {
	return ((text && text.match(regexp) || {}).groups || {});
}

utils.args = (args) => {
	args = args || process.argv.slice(2);

	let argsRegex = null;
	try {
		argsRegex = new RegExp('^--(?<prop>[\\w-]+)(=(?<value>.+))?$');
	} catch(ex) { /*console.log(ex);*/ }

	let o = { }

	if(!argsRegex) {

		args.forEach((arg)=>{
			arg = arg.split('=');
			let k = arg.shift();
			let v = arg.shift();
			k = k.replace(/^--/,'');
			if(v !== undefined) o[k] = v; else o[k] = true;
		});

		return o;
	}

	args.map((arg) => {
		const { prop, value } = utils.match(arg,argsRegex);

		if(value == undefined)
			o[prop] = true;
		else
		if(o[prop]) {
			if(Array.isArray(o[prop]))
				o[prop].push(value);
			else
				o[prop] = [o[prop], value];
		}
		else {
			o[prop] = value;
		}
	})
	return o;
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

if(!Number.prototype.toFileSize) {
	Object.defineProperty(Number.prototype, 'toFileSize', {
		value: function(a, asNumber){
			let b,c,d;
			let r = (
				a=a?[1e3,'k','B']:[1024,'K','iB'],
				b=Math,
				c=b.log,
				d=c(this)/c(a[0])|0,this/b.pow(a[0],d)
			).toFixed(2)

			if(!asNumber)
				r += ' '+(d?(a[1]+'MGTPEZY')[--d]+a[2]:'Bytes');
			return r;
		},
		writable:false,
		enumerable:false
	});
}

if(!Number.prototype.toCS) {
	Object.defineProperty(Number.prototype, 'toCS', {
	   value: function(p, tz){
			let precision = p || 0;
			let f = (this).toFixed(precision).split('.');
			f[0] = f[0].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			let t = f.join('.');
			if(!tz || !~t.indexOf('.'))
				return t;
			while(t.length > 2 && t[t.length-1] == 0 && t[t.length-2] != '.')
				t = t.substring(0, t.length-1);
			return t;
		},
		writable:false,
		enumerable:false
	});
}

utils.mergeObjects = (dst, ...src_)=>{
    src_.forEach((src)=>{
        _.each(src, (v, k)=>{
            if(_.isArray(v)){
                dst[k] = [];
                utils.merge(dst[k], v);
            }else if(_.isObject(v)) {
                if(!dst[k] || _.isString(dst[k]) || !_.isObject(dst[k]))
                    dst[k] = { };
                utils.merge(dst[k], v);
            }else{
                if(_.isArray(src))
                    dst.push(v);
                else
                    dst[k] = v;
            }
        })
    })
    return dst;
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



module.exports = utils;
