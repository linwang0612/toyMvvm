class Dep { // 被观察者 自己的数据变化 通知所有观察者
    constructor() {
        this.subs = [] // 用来存放观察者的数组
    }
    addSub(watcher) { // 订阅
        this.subs.push(watcher)
    }
    notify() { // 发布
        this.subs.forEach(watcher => watcher.updata())
    }
}

class Watcher { // 观察者 数据一变化 调用回调更新视图
    constructor(vm, expr, cb) {
        this.vm = vm
        this.expr = expr
        this.cb = cb
        this.oldValue = this.get() // 存放一个老值
    }
    get() {
        Dep.target = this // 将当前的watcher缓存在 Dep.target
        let value = CompilerUnit.getVal(this.vm, this.expr)
        Dep.target = null
        return value
    }
    updata() {
        let newValue = CompilerUnit.getVal(this.vm, this.expr)
        if (newValue != this.oldValue) {
            this.cb(newValue)
        }
    }
}

class Observer { // 实现数据劫持的功能
    constructor(data) {
        this.observer(data)
    }
    observer(data) {
        if (data && typeof data === 'object') {
            for(let key in data) {
                this.defineReactive(data, key, data[key])
            }
        }
    }
    defineReactive(obj, key, value) {
        this.observer(value)
        let dep = new Dep() // 给每个数据添加被观察者
        Object.defineProperty(obj, key, {
            get() {
                Dep.target && dep.addSub(Dep.target) 
                return value
            },
            set:(newValue) => {
                if (newValue != value) {
                    this.observer(newValue)
                    value = newValue
                    dep.notify()
                }
            }
        })
    }
}

class Compiler {
    constructor(el, vm) {
        this.el = this.isElementNode(el) ? el : document.querySelector(el)
        this.vm = vm

        // 将当前节点的元素全部丢到内存中去(源码是通过ast)
        let fragment = this.noToFragment(this.el)
        
        // 编译模板 用数据替换
        this.complie(fragment)

        // 将内存的节点放回到页面中
        this.el.appendChild(fragment)
    }
    complie(node) { // 将内存中的节点编译
        let childNodes = node.childNodes
        const childs = [...childNodes]
        childs.forEach(child => {
            if (this.isElementNode(child)) { //如果是节点 走节点的编译
                this.complieElement(child)
            } else { // 否则走文本的编译
                this.complieText(child)
            }
        })
    }
    isDirective(attrName) { // 判断是不是指令 v-xxx
        return attrName.startsWith('v-')
    }
    complieElement(node) { // 编译节点
        this.complie(node) //如何是节点 节点内部的节点或者元素也要编译
        const attributes = node.attributes
        const attrs = [...attributes]
        attrs.forEach(attr => {
            const {name, value:expr} = attr
            if (this.isDirective(name)) { // v-model v-html
                let [, directive] = name.split('-') // 拿到 model html
                CompilerUnit[directive](node, expr, this.vm) // 不同的指令走不同的处理函数
            }
        })
    }
    complieText(node) { // 编译文本
        const content = node.textContent
        if (/\{\{(.+?)\}\}/.test(content)) {//正则匹配{{ xxx }}的文本节点
            CompilerUnit['text'](node, content, this.vm)
        }
    }
    isElementNode(node) { // 判断是否是node节点
        return node.nodeType === 1
    }
    noToFragment(node) { // 将元素丢到文档碎片中
        let fragment = document.createDocumentFragment()
        let firstChild
        while (firstChild = node.firstChild) {
            fragment.appendChild(firstChild)
        }
        return fragment
    }
}

CompilerUnit = {
    getVal(vm, expr) { // 根据 man.name 拿到 $data 里面的name的值
        return expr.split('.').reduce((data, current) => {
            return data[current]
        }, vm.$data)
    },
    setVal(vm, expr, val) {
        expr.split('.').reduce((data, current, index, array) =>{
            if(index === array.length - 1) { // 如果是遍历到最后一项 也就是取到对应的值 重新赋值
                data[current] = val
            }
            return data[current]
        }, vm.$data)
    },
    model(node, expr, vm) {
        const fn = this.updata['modelUpdata']
        new Watcher(vm, expr, (newValue) => {
            fn(node, newValue)
        })
        node.addEventListener('input', (e) => {
            const value = e.target.value
            this.setVal(vm, expr, value)
        })
        let value = this.getVal(vm, expr)
        fn(node, value)
    },
    getContentValue(vm, expr) {
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(vm, args[1].trim())
        })
    },
    text(node, expr, vm) {
        const fn = this.updata['textUpdata']
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            new Watcher(vm, args[1].trim(), () => {
                fn(node, this.getContentValue(vm, expr))
            })
            return this.getVal(vm, args[1].trim()) 
        })
        fn(node, content)
    },
    updata: { // 更新页面数据的方法集合
        modelUpdata(node, newValue) {
            node.value = newValue
        },
        textUpdata(node, newValue) {
            node.textContent = newValue
        }
    }
}

class Vue {
    constructor(options) {
        this.$el = options.el
        this.$data = options.data

        if (this.$el) { 
            new Observer(this.$data) 
            new Compiler(this.$el, this)
        }
    }
}