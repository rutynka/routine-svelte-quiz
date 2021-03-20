
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
function noop() { }
const identity = x => x;
function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
        loc: { file, line, column, char }
    };
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function null_to_empty(value) {
    return value == null ? '' : value;
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
function run_tasks(now) {
    tasks.forEach(task => {
        if (!task.c(now)) {
            tasks.delete(task);
            task.f();
        }
    });
    if (tasks.size !== 0)
        raf(run_tasks);
}
/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 */
function loop(callback) {
    let task;
    if (tasks.size === 0)
        raf(run_tasks);
    return {
        promise: new Promise(fulfill => {
            tasks.add(task = { c: callback, f: fulfill });
        }),
        abort() {
            tasks.delete(task);
        }
    };
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function set_custom_element_data(node, prop, value) {
    if (prop in node) {
        node[prop] = value;
    }
    else {
        attr(node, prop, value);
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

const active_docs = new Set();
let active = 0;
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    const doc = node.ownerDocument;
    active_docs.add(doc);
    const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
    const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
    if (!current_rules[name]) {
        current_rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    const previous = (node.style.animation || '').split(', ');
    const next = previous.filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    );
    const deleted = previous.length - next.length;
    if (deleted) {
        node.style.animation = next.join(', ');
        active -= deleted;
        if (!active)
            clear_rules();
    }
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        active_docs.forEach(doc => {
            const stylesheet = doc.__svelte_stylesheet;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            doc.__svelte_rules = {};
        });
        active_docs.clear();
    });
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
function add_flush_callback(fn) {
    flush_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
const null_transition = { duration: 0 };
function create_in_transition(node, fn, params) {
    let config = fn(node, params);
    let running = false;
    let animation_name;
    let task;
    let uid = 0;
    function cleanup() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
        tick(0, 1);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        if (task)
            task.abort();
        running = true;
        add_render_callback(() => dispatch(node, true, 'start'));
        task = loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(1, 0);
                    dispatch(node, true, 'end');
                    cleanup();
                    return running = false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(t, 1 - t);
                }
            }
            return running;
        });
    }
    let started = false;
    return {
        start() {
            if (started)
                return;
            delete_rule(node);
            if (is_function(config)) {
                config = config();
                wait().then(go);
            }
            else {
                go();
            }
        },
        invalidate() {
            started = false;
        },
        end() {
            if (running) {
                cleanup();
                running = false;
            }
        }
    };
}

const globals = (typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
        ? globalThis
        : global);

function bind(component, name, callback) {
    const index = component.$$.props[name];
    if (index !== undefined) {
        component.$$.bound[index] = callback;
        callback(component.$$.ctx[index]);
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.35.0' }, detail)));
}
function append_dev(target, node) {
    dispatch_dev('SvelteDOMInsert', { target, node });
    append(target, node);
}
function insert_dev(target, node, anchor) {
    dispatch_dev('SvelteDOMInsert', { target, node, anchor });
    insert(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev('SvelteDOMRemove', { node });
    detach(node);
}
function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
    const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
    if (has_prevent_default)
        modifiers.push('preventDefault');
    if (has_stop_propagation)
        modifiers.push('stopPropagation');
    dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
    const dispose = listen(node, event, handler, options);
    return () => {
        dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
        dispose();
    };
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
    else
        dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
}
function set_data_dev(text, data) {
    data = '' + data;
    if (text.wholeText === data)
        return;
    dispatch_dev('SvelteDOMSetData', { node: text, data });
    text.data = data;
}
function validate_each_argument(arg) {
    if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
        let msg = '{#each} only iterates over array-like objects.';
        if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
            msg += ' You can use a spread to convert this iterable into an array.';
        }
        throw new Error(msg);
    }
}
function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
        if (!~keys.indexOf(slot_key)) {
            console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
        }
    }
}
/**
 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
 */
class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
        if (!options || (!options.target && !options.$$inline)) {
            throw new Error("'target' is a required option");
        }
        super();
    }
    $destroy() {
        super.$destroy();
        this.$destroy = () => {
            console.warn('Component was already destroyed'); // eslint-disable-line no-console
        };
    }
    $capture_state() { }
    $inject_state() { }
}

/* node_modules/@rutynka/helper-progress/src/Progress.svelte generated by Svelte v3.35.0 */

const { Object: Object_1, console: console_1$2 } = globals;
const file$4 = "node_modules/@rutynka/helper-progress/src/Progress.svelte";

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[17] = list[i];
	return child_ctx;
}

// (138:2) {#if show}
function create_if_block$3(ctx) {
	let div0;
	let t0;
	let div8;
	let span0;
	let t2;
	let div1;
	let t3;
	let div2;
	let t4;
	let div3;
	let t5;
	let div4;
	let t6;
	let div5;
	let t7;
	let div6;
	let t8;
	let div7;
	let t9;
	let span1;
	let each_value = /*calendar*/ ctx[1];
	validate_each_argument(each_value);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const block = {
		c: function create() {
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t0 = space();
			div8 = element("div");
			span0 = element("span");
			span0.textContent = "Less";
			t2 = space();
			div1 = element("div");
			t3 = space();
			div2 = element("div");
			t4 = space();
			div3 = element("div");
			t5 = space();
			div4 = element("div");
			t6 = space();
			div5 = element("div");
			t7 = space();
			div6 = element("div");
			t8 = space();
			div7 = element("div");
			t9 = space();
			span1 = element("span");
			span1.textContent = "More";
			attr_dev(div0, "id", "cal");
			attr_dev(div0, "class", "days svelte-12xblv0");
			add_location(div0, file$4, 138, 3, 4122);
			attr_dev(span0, "class", "svelte-12xblv0");
			add_location(span0, file$4, 144, 4, 4373);
			attr_dev(div1, "class", "sq tiny sqc-0 svelte-12xblv0");
			add_location(div1, file$4, 145, 4, 4395);
			attr_dev(div2, "class", "sq tiny sqc-1 svelte-12xblv0");
			add_location(div2, file$4, 146, 4, 4433);
			attr_dev(div3, "class", "sq tiny sqc-2 svelte-12xblv0");
			add_location(div3, file$4, 147, 4, 4471);
			attr_dev(div4, "class", "sq tiny sqc-3 svelte-12xblv0");
			add_location(div4, file$4, 148, 4, 4509);
			attr_dev(div5, "class", "sq tiny sqc-4 svelte-12xblv0");
			add_location(div5, file$4, 149, 4, 4547);
			attr_dev(div6, "class", "sq tiny sqc-5 svelte-12xblv0");
			add_location(div6, file$4, 150, 4, 4585);
			attr_dev(div7, "class", "sq tiny sqc-6 svelte-12xblv0");
			add_location(div7, file$4, 151, 4, 4623);
			attr_dev(span1, "class", "svelte-12xblv0");
			add_location(span1, file$4, 152, 4, 4661);
			attr_dev(div8, "class", "legend prgs svelte-12xblv0");
			add_location(div8, file$4, 143, 3, 4343);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div0, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			insert_dev(target, t0, anchor);
			insert_dev(target, div8, anchor);
			append_dev(div8, span0);
			append_dev(div8, t2);
			append_dev(div8, div1);
			append_dev(div8, t3);
			append_dev(div8, div2);
			append_dev(div8, t4);
			append_dev(div8, div3);
			append_dev(div8, t5);
			append_dev(div8, div4);
			append_dev(div8, t6);
			append_dev(div8, div5);
			append_dev(div8, t7);
			append_dev(div8, div6);
			append_dev(div8, t8);
			append_dev(div8, div7);
			append_dev(div8, t9);
			append_dev(div8, span1);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*calendar, css_today*/ 6) {
				each_value = /*calendar*/ ctx[1];
				validate_each_argument(each_value);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div0, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div0);
			destroy_each(each_blocks, detaching);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(div8);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$3.name,
		type: "if",
		source: "(138:2) {#if show}",
		ctx
	});

	return block;
}

// (140:4) {#each calendar as row }
function create_each_block$1(ctx) {
	let div;
	let div_data_cal_value;
	let div_title_value;
	let div_class_value;

	const block = {
		c: function create() {
			div = element("div");
			attr_dev(div, "data-cal", div_data_cal_value = /*row*/ ctx[17].search_date);
			attr_dev(div, "title", div_title_value = /*row*/ ctx[17].title);

			attr_dev(div, "class", div_class_value = "" + ((/*row*/ ctx[17].search_date === /*css_today*/ ctx[2]
			? "today "
			: "") + "sq big sqc-" + /*row*/ ctx[17].val + " svelte-12xblv0"));

			add_location(div, file$4, 140, 4, 4183);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*calendar*/ 2 && div_data_cal_value !== (div_data_cal_value = /*row*/ ctx[17].search_date)) {
				attr_dev(div, "data-cal", div_data_cal_value);
			}

			if (dirty & /*calendar*/ 2 && div_title_value !== (div_title_value = /*row*/ ctx[17].title)) {
				attr_dev(div, "title", div_title_value);
			}

			if (dirty & /*calendar*/ 2 && div_class_value !== (div_class_value = "" + ((/*row*/ ctx[17].search_date === /*css_today*/ ctx[2]
			? "today "
			: "") + "sq big sqc-" + /*row*/ ctx[17].val + " svelte-12xblv0"))) {
				attr_dev(div, "class", div_class_value);
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_each_block$1.name,
		type: "each",
		source: "(140:4) {#each calendar as row }",
		ctx
	});

	return block;
}

function create_fragment$4(ctx) {
	let prgs_calendar;
	let if_block = /*show*/ ctx[0] && create_if_block$3(ctx);

	const block = {
		c: function create() {
			prgs_calendar = element("prgs-calendar");
			if (if_block) if_block.c();
			set_custom_element_data(prgs_calendar, "class", "prgs svelte-12xblv0");
			add_location(prgs_calendar, file$4, 136, 0, 4077);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, prgs_calendar, anchor);
			if (if_block) if_block.m(prgs_calendar, null);
		},
		p: function update(ctx, [dirty]) {
			if (/*show*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$3(ctx);
					if_block.c();
					if_block.m(prgs_calendar, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(prgs_calendar);
			if (if_block) if_block.d();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$4.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function send_progress(ev) {
	const progress = {
		"collectionName": ev.collectionName,
		"type": "finish",
		"point": 1,
		"percent": 100,
		"exerciseTime": typeof ev !== "undefined" && ev.t
		? ev.t
		: bb.get_timer(),
		"correctHit": typeof ev !== "undefined" && ev.correct
		? ev.correct
		: bb.correct_list.length,
		"wrongHit": typeof ev !== "undefined" && ev.wrong
		? ev.wrong
		: bb.correct_list.length
	};

	const request = new Request(window.allTheFish.api.progressURL, { method: "PUT" });

	fetch(request, {
		credentials: "include",
		headers: {
			"Content-Type": "application/json; charset=utf-8"
		},
		body: JSON.stringify(progress)
	}).then(function (response) {
		//console.log(compiled(response.data));
		return response.json();
	});

	console.log("fetch or localstorage");
}

function instance$4($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Progress", slots, []);
	let { LANG = "en" } = $$props;
	let { DAYS = 14 } = $$props;
	let { show = false } = $$props;
	let { DAYS_BEFORE = 13 } = $$props;
	let { localstorage_key = window.location.href } = $$props;
	let today = new Date();
	let css_today = search_date_format(today);
	today.setDate(today.getDate() - DAYS_BEFORE);
	let calendar = init_calendar_day_sequence();

	const store_progress = function (ev) {
		ev = ev || {};
		set_default(ev);

		if (ev.store_db) {
			send_progress(ev);
		}

		add_to_local_storage(ev);
		update_calendar(packHitsInaDay(get_storage()));
		$$invalidate(0, show = true);
	};

	console.log("progress helper loaded v0.0.5");

	function set_default(ev) {
		$$invalidate(3, localstorage_key = ev.collectionName
		? ev.collectionName
		: window.location.href);

		ev.collectionName = ev.collectionName === undefined
		? window.location.href
		: ev.collectionName;

		if (ev.dT === undefined) {
			ev.dT = search_date_format(new Date());
		}
	}

	function init_calendar_day_sequence() {
		let sequence = [];
		let today = new Date();
		today.setDate(today.getDate() - DAYS_BEFORE);

		for (let i = 0; i < DAYS; i++) {
			sequence.push({
				val: 0,
				title: date_format(new Date(today.setDate(today.getDate() + 1))),
				search_date: search_date_format(new Date(today.setDate(today.getDate())))
			});
		}

		return sequence;
	}

	function date_format(d) {
		const ye = new Intl.DateTimeFormat(LANG, { year: "numeric" }).format(d);
		const mo = new Intl.DateTimeFormat(LANG, { month: "short" }).format(d);
		const da = new Intl.DateTimeFormat(LANG, { day: "2-digit" }).format(d);
		return `${da}-${mo}-${ye}`;
	}

	function search_date_format(d) {
		const ye = new Intl.DateTimeFormat(LANG, { year: "numeric" }).format(d);
		const mo = new Intl.DateTimeFormat(LANG, { month: "numeric" }).format(d);
		const da = new Intl.DateTimeFormat(LANG, { day: "2-digit" }).format(d);
		return `${ye}-${mo}-${da}`;
	}

	function packHitsInaDay(eventsData) {
		let eventByDates = {};

		if (eventsData.length <= 0) {
			console.log("event data not found or invalid localstorage key");
			return {};
		}

		for (let i = 0; i < eventsData.length; i++) {
			let dateFromEvent = new Date(eventsData[i].dT.replace(" CET", ""));

			if (isNaN(dateFromEvent.getDate())) {
				continue;
			}

			let dateSearchFormat = search_date_format(dateFromEvent);

			if (eventByDates[dateSearchFormat] === undefined) {
				eventByDates[dateSearchFormat] = 1;
			} else {
				eventByDates[dateSearchFormat] = eventByDates[dateSearchFormat] < 6
				? eventByDates[dateSearchFormat] + 1
				: eventByDates[dateSearchFormat] = 6;
			}

			console.log("dT:", dateSearchFormat);
		}

		console.log(eventByDates);
		return eventByDates;
	}

	function update_calendar(eventsByDate) {
		let dateEventsKey = Object.keys(eventsByDate);

		for (let i = 0; i < calendar.length; i++) {
			if (dateEventsKey.indexOf(calendar[i].search_date) !== -1) {
				$$invalidate(1, calendar[i].val = eventsByDate[calendar[i].search_date], calendar);
			}
		}
	}

	let get_storage = () => {
		if (!localStorage.getItem(localstorage_key)) {
			return [];
		}

		return JSON.parse(localStorage.getItem(localstorage_key));
	};

	const add_to_local_storage = ev => {
		if (ev.collectionName) {
			let storage = get_storage();
			storage.push(ev);
			localStorage.setItem(localstorage_key, JSON.stringify(storage));
		}
	};

	const writable_props = ["LANG", "DAYS", "show", "DAYS_BEFORE", "localstorage_key"];

	Object_1.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$2.warn(`<Progress> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("LANG" in $$props) $$invalidate(4, LANG = $$props.LANG);
		if ("DAYS" in $$props) $$invalidate(5, DAYS = $$props.DAYS);
		if ("show" in $$props) $$invalidate(0, show = $$props.show);
		if ("DAYS_BEFORE" in $$props) $$invalidate(6, DAYS_BEFORE = $$props.DAYS_BEFORE);
		if ("localstorage_key" in $$props) $$invalidate(3, localstorage_key = $$props.localstorage_key);
	};

	$$self.$capture_state = () => ({
		LANG,
		DAYS,
		show,
		DAYS_BEFORE,
		localstorage_key,
		today,
		css_today,
		calendar,
		store_progress,
		set_default,
		send_progress,
		init_calendar_day_sequence,
		date_format,
		search_date_format,
		packHitsInaDay,
		update_calendar,
		get_storage,
		add_to_local_storage
	});

	$$self.$inject_state = $$props => {
		if ("LANG" in $$props) $$invalidate(4, LANG = $$props.LANG);
		if ("DAYS" in $$props) $$invalidate(5, DAYS = $$props.DAYS);
		if ("show" in $$props) $$invalidate(0, show = $$props.show);
		if ("DAYS_BEFORE" in $$props) $$invalidate(6, DAYS_BEFORE = $$props.DAYS_BEFORE);
		if ("localstorage_key" in $$props) $$invalidate(3, localstorage_key = $$props.localstorage_key);
		if ("today" in $$props) today = $$props.today;
		if ("css_today" in $$props) $$invalidate(2, css_today = $$props.css_today);
		if ("calendar" in $$props) $$invalidate(1, calendar = $$props.calendar);
		if ("get_storage" in $$props) get_storage = $$props.get_storage;
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [
		show,
		calendar,
		css_today,
		localstorage_key,
		LANG,
		DAYS,
		DAYS_BEFORE,
		store_progress
	];
}

class Progress extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
			LANG: 4,
			DAYS: 5,
			show: 0,
			DAYS_BEFORE: 6,
			localstorage_key: 3,
			store_progress: 7
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Progress",
			options,
			id: create_fragment$4.name
		});
	}

	get LANG() {
		return this.$$.ctx[4];
	}

	set LANG(LANG) {
		this.$set({ LANG });
		flush();
	}

	get DAYS() {
		return this.$$.ctx[5];
	}

	set DAYS(DAYS) {
		this.$set({ DAYS });
		flush();
	}

	get show() {
		return this.$$.ctx[0];
	}

	set show(show) {
		this.$set({ show });
		flush();
	}

	get DAYS_BEFORE() {
		return this.$$.ctx[6];
	}

	set DAYS_BEFORE(DAYS_BEFORE) {
		this.$set({ DAYS_BEFORE });
		flush();
	}

	get localstorage_key() {
		return this.$$.ctx[3];
	}

	set localstorage_key(localstorage_key) {
		this.$set({ localstorage_key });
		flush();
	}

	get store_progress() {
		return this.$$.ctx[7];
	}

	set store_progress(value) {
		throw new Error("<Progress>: Cannot set read-only property 'store_progress'");
	}
}

function cubicOut(t) {
    const f = t - 1.0;
    return f * f * f + 1.0;
}

function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
    const style = getComputedStyle(node);
    const target_opacity = +style.opacity;
    const transform = style.transform === 'none' ? '' : style.transform;
    const od = target_opacity * (1 - opacity);
    return {
        delay,
        duration,
        easing,
        css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
    };
}

/* node_modules/@rutynka/helper-bar-board/src/Board.svelte generated by Svelte v3.35.0 */
const file$3 = "node_modules/@rutynka/helper-bar-board/src/Board.svelte";

// (22:0) {#if visible}
function create_if_block$2(ctx) {
	let span;
	let t;
	let span_intro;

	const block = {
		c: function create() {
			span = element("span");
			t = text(/*question*/ ctx[0]);
			attr_dev(span, "id", "board");
			attr_dev(span, "class", "board--text svelte-j0o2qa");
			add_location(span, file$3, 22, 4, 589);
		},
		m: function mount(target, anchor) {
			insert_dev(target, span, anchor);
			append_dev(span, t);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*question*/ 1) set_data_dev(t, /*question*/ ctx[0]);
		},
		i: function intro(local) {
			if (!span_intro) {
				add_render_callback(() => {
					span_intro = create_in_transition(span, fly, { y: 200, duration: 2000 });
					span_intro.start();
				});
			}
		},
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(span);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$2.name,
		type: "if",
		source: "(22:0) {#if visible}",
		ctx
	});

	return block;
}

function create_fragment$3(ctx) {
	let if_block_anchor;
	let if_block = /*visible*/ ctx[1] && create_if_block$2(ctx);

	const block = {
		c: function create() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
		},
		p: function update(ctx, [dirty]) {
			if (/*visible*/ ctx[1]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*visible*/ 2) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block$2(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: function intro(local) {
			transition_in(if_block);
		},
		o: noop,
		d: function destroy(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$3.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$3($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Board", slots, []);
	let { question = "" } = $$props;
	let visible = false;
	const writable_props = ["question"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Board> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("question" in $$props) $$invalidate(0, question = $$props.question);
	};

	$$self.$capture_state = () => ({ fly, question, visible });

	$$self.$inject_state = $$props => {
		if ("question" in $$props) $$invalidate(0, question = $$props.question);
		if ("visible" in $$props) $$invalidate(1, visible = $$props.visible);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*question*/ 1) {
			// function anime() {
			//     let el = document.getElementById('board')
			//     if (el) {
			//         el.classList.add('board--fade');
			//         console.log('color transparent')
			//         setTimeout(()=>{
			//             document.getElementById('board').classList.remove('board--fade');
			//         }, 25000);
			//
			//     }
			// }
			$$invalidate(0, question = (() => {
				$$invalidate(1, visible = true);
				return question;
			})());
		}
	};

	return [question, visible];
}

class Board extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { question: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Board",
			options,
			id: create_fragment$3.name
		});
	}

	get question() {
		throw new Error("<Board>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set question(value) {
		throw new Error("<Board>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/@rutynka/helper-bar-board/src/Timer.svelte generated by Svelte v3.35.0 */

const file$2 = "node_modules/@rutynka/helper-bar-board/src/Timer.svelte";

// (20:4) {#if timer !== 0}
function create_if_block$1(ctx) {
	let span;
	let t0;
	let t1;

	const block = {
		c: function create() {
			span = element("span");
			t0 = text(/*timer*/ ctx[0]);
			t1 = text(" s");
			attr_dev(span, "data-timer", /*timer*/ ctx[0]);
			attr_dev(span, "class", "timer");
			attr_dev(span, "id", "boardTimer");
			add_location(span, file$2, 20, 8, 403);
		},
		m: function mount(target, anchor) {
			insert_dev(target, span, anchor);
			append_dev(span, t0);
			append_dev(span, t1);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*timer*/ 1) set_data_dev(t0, /*timer*/ ctx[0]);

			if (dirty & /*timer*/ 1) {
				attr_dev(span, "data-timer", /*timer*/ ctx[0]);
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(span);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$1.name,
		type: "if",
		source: "(20:4) {#if timer !== 0}",
		ctx
	});

	return block;
}

function create_fragment$2(ctx) {
	let div;
	let if_block = /*timer*/ ctx[0] !== 0 && create_if_block$1(ctx);

	const block = {
		c: function create() {
			div = element("div");
			if (if_block) if_block.c();
			attr_dev(div, "class", "counter counter--options svelte-1y9c0le");
			add_location(div, file$2, 18, 0, 334);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			if (if_block) if_block.m(div, null);
		},
		p: function update(ctx, [dirty]) {
			if (/*timer*/ ctx[0] !== 0) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$1(ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			if (if_block) if_block.d();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$2.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$2($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Timer", slots, []);
	let { start_timer } = $$props;
	let { timer = 0 } = $$props;
	let interval = {};

	function stop() {
		clearInterval(interval);
	}

	function start() {
		$$invalidate(0, timer = 0);
		stop();

		interval = setInterval(
			() => {
				$$invalidate(0, timer++, timer);
			},
			1000
		);
	}

	const writable_props = ["start_timer", "timer"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Timer> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ("start_timer" in $$props) $$invalidate(1, start_timer = $$props.start_timer);
		if ("timer" in $$props) $$invalidate(0, timer = $$props.timer);
	};

	$$self.$capture_state = () => ({
		start_timer,
		timer,
		interval,
		stop,
		start
	});

	$$self.$inject_state = $$props => {
		if ("start_timer" in $$props) $$invalidate(1, start_timer = $$props.start_timer);
		if ("timer" in $$props) $$invalidate(0, timer = $$props.timer);
		if ("interval" in $$props) interval = $$props.interval;
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*start_timer*/ 2) {
			start_timer ? start() : stop();
		}
	};

	return [timer, start_timer];
}

class Timer extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { start_timer: 1, timer: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Timer",
			options,
			id: create_fragment$2.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*start_timer*/ ctx[1] === undefined && !("start_timer" in props)) {
			console.warn("<Timer> was created without expected prop 'start_timer'");
		}
	}

	get start_timer() {
		throw new Error("<Timer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set start_timer(value) {
		throw new Error("<Timer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get timer() {
		throw new Error("<Timer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set timer(value) {
		throw new Error("<Timer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* node_modules/@rutynka/helper-bar-board/src/Bar.svelte generated by Svelte v3.35.0 */

const { console: console_1$1 } = globals;
const file$1 = "node_modules/@rutynka/helper-bar-board/src/Bar.svelte";

// (45:1) {#if question}
function create_if_block(ctx) {
	let div2;
	let div0;
	let span0;
	let t0;
	let t1;
	let span1;
	let t2;
	let span1_class_value;
	let t3;
	let board;
	let t4;
	let timer;
	let updating_start_timer;
	let t5;
	let div1;
	let current;

	board = new Board({
			props: { question: /*question*/ ctx[0] },
			$$inline: true
		});

	function timer_start_timer_binding(value) {
		/*timer_start_timer_binding*/ ctx[10](value);
	}

	let timer_props = {};

	if (/*set_timer*/ ctx[1] !== void 0) {
		timer_props.start_timer = /*set_timer*/ ctx[1];
	}

	timer = new Timer({ props: timer_props, $$inline: true });
	binding_callbacks.push(() => bind(timer, "start_timer", timer_start_timer_binding));

	const block = {
		c: function create() {
			div2 = element("div");
			div0 = element("div");
			span0 = element("span");
			t0 = text(/*correct*/ ctx[2]);
			t1 = space();
			span1 = element("span");
			t2 = text(/*wrong*/ ctx[3]);
			t3 = space();
			create_component(board.$$.fragment);
			t4 = space();
			create_component(timer.$$.fragment);
			t5 = space();
			div1 = element("div");
			attr_dev(span0, "id", "correctCounter");
			attr_dev(span0, "class", "svelte-efik5t");
			add_location(span0, file$1, 47, 4, 1044);
			attr_dev(span1, "id", "wrongCounter");
			attr_dev(span1, "class", span1_class_value = "" + (null_to_empty(/*wrong*/ ctx[3] ? "" : "visibility") + " svelte-efik5t"));
			add_location(span1, file$1, 48, 4, 1092);
			attr_dev(div0, "id", "boardCounters");
			attr_dev(div0, "class", "score score--absolute svelte-efik5t");
			add_location(div0, file$1, 46, 3, 985);
			attr_dev(div1, "id", "progressBar");
			attr_dev(div1, "class", "bar--progress");
			add_location(div1, file$1, 52, 3, 1246);
			attr_dev(div2, "id", "bar");
			attr_dev(div2, "class", "bar bar--display bar--sticky svelte-efik5t");
			attr_dev(div2, "data-domain", "https://public.local");
			add_location(div2, file$1, 45, 2, 895);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div2, anchor);
			append_dev(div2, div0);
			append_dev(div0, span0);
			append_dev(span0, t0);
			append_dev(div0, t1);
			append_dev(div0, span1);
			append_dev(span1, t2);
			append_dev(div2, t3);
			mount_component(board, div2, null);
			append_dev(div2, t4);
			mount_component(timer, div2, null);
			append_dev(div2, t5);
			append_dev(div2, div1);
			current = true;
		},
		p: function update(ctx, dirty) {
			if (!current || dirty & /*correct*/ 4) set_data_dev(t0, /*correct*/ ctx[2]);
			if (!current || dirty & /*wrong*/ 8) set_data_dev(t2, /*wrong*/ ctx[3]);

			if (!current || dirty & /*wrong*/ 8 && span1_class_value !== (span1_class_value = "" + (null_to_empty(/*wrong*/ ctx[3] ? "" : "visibility") + " svelte-efik5t"))) {
				attr_dev(span1, "class", span1_class_value);
			}

			const board_changes = {};
			if (dirty & /*question*/ 1) board_changes.question = /*question*/ ctx[0];
			board.$set(board_changes);
			const timer_changes = {};

			if (!updating_start_timer && dirty & /*set_timer*/ 2) {
				updating_start_timer = true;
				timer_changes.start_timer = /*set_timer*/ ctx[1];
				add_flush_callback(() => updating_start_timer = false);
			}

			timer.$set(timer_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(board.$$.fragment, local);
			transition_in(timer.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(board.$$.fragment, local);
			transition_out(timer.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div2);
			destroy_component(board);
			destroy_component(timer);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(45:1) {#if question}",
		ctx
	});

	return block;
}

function create_fragment$1(ctx) {
	let bb_helper;
	let current;
	let if_block = /*question*/ ctx[0] && create_if_block(ctx);

	const block = {
		c: function create() {
			bb_helper = element("bb-helper");
			if (if_block) if_block.c();
			set_custom_element_data(bb_helper, "id", "bb");
			add_location(bb_helper, file$1, 43, 0, 857);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			insert_dev(target, bb_helper, anchor);
			if (if_block) if_block.m(bb_helper, null);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			if (/*question*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*question*/ 1) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(bb_helper, null);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(bb_helper);
			if (if_block) if_block.d();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$1.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$1($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("Bar", slots, []);
	let { question = "" } = $$props;
	let { reset = false } = $$props;
	let { set_timer = false } = $$props;
	let { wrong_list = [] } = $$props;
	let { correct_list = [] } = $$props;
	let correct = 0;
	let wrong = 0;

	const set_wrong = function (x, y) {
		wrong_list.push([x, y]);
		$$invalidate(3, wrong++, wrong);
	};

	const set_correct = function (x, y) {
		correct_list.push([x, y]);
		$$invalidate(2, correct++, correct);
	};

	const get_timer = function () {
		let t = document.getElementById("boardTimer");
		return t ? t.getAttribute("data-timer") : 0;
	};

	console.log("bar board loaded v 0.0.3");
	const writable_props = ["question", "reset", "set_timer", "wrong_list", "correct_list"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<Bar> was created with unknown prop '${key}'`);
	});

	function timer_start_timer_binding(value) {
		set_timer = value;
		($$invalidate(1, set_timer), $$invalidate(4, reset));
	}

	$$self.$$set = $$props => {
		if ("question" in $$props) $$invalidate(0, question = $$props.question);
		if ("reset" in $$props) $$invalidate(4, reset = $$props.reset);
		if ("set_timer" in $$props) $$invalidate(1, set_timer = $$props.set_timer);
		if ("wrong_list" in $$props) $$invalidate(5, wrong_list = $$props.wrong_list);
		if ("correct_list" in $$props) $$invalidate(6, correct_list = $$props.correct_list);
	};

	$$self.$capture_state = () => ({
		Board,
		Timer,
		question,
		reset,
		set_timer,
		wrong_list,
		correct_list,
		correct,
		wrong,
		set_wrong,
		set_correct,
		get_timer
	});

	$$self.$inject_state = $$props => {
		if ("question" in $$props) $$invalidate(0, question = $$props.question);
		if ("reset" in $$props) $$invalidate(4, reset = $$props.reset);
		if ("set_timer" in $$props) $$invalidate(1, set_timer = $$props.set_timer);
		if ("wrong_list" in $$props) $$invalidate(5, wrong_list = $$props.wrong_list);
		if ("correct_list" in $$props) $$invalidate(6, correct_list = $$props.correct_list);
		if ("correct" in $$props) $$invalidate(2, correct = $$props.correct);
		if ("wrong" in $$props) $$invalidate(3, wrong = $$props.wrong);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*reset*/ 16) {
			if (reset === true) {
				console.log("reset");
				$$invalidate(2, correct = 0);
				$$invalidate(3, wrong = 0);
				$$invalidate(6, correct_list = []);
				$$invalidate(5, wrong_list = []);
				$$invalidate(0, question = " ");
				$$invalidate(1, set_timer = false);
				$$invalidate(4, reset = false);
			}
		}

		if ($$self.$$.dirty & /*question*/ 1) ;

		if ($$self.$$.dirty & /*correct*/ 4) ;

		if ($$self.$$.dirty & /*wrong*/ 8) ;
	};

	return [
		question,
		set_timer,
		correct,
		wrong,
		reset,
		wrong_list,
		correct_list,
		set_wrong,
		set_correct,
		get_timer,
		timer_start_timer_binding
	];
}

class Bar extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
			question: 0,
			reset: 4,
			set_timer: 1,
			wrong_list: 5,
			correct_list: 6,
			set_wrong: 7,
			set_correct: 8,
			get_timer: 9
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Bar",
			options,
			id: create_fragment$1.name
		});
	}

	get question() {
		return this.$$.ctx[0];
	}

	set question(question) {
		this.$set({ question });
		flush();
	}

	get reset() {
		return this.$$.ctx[4];
	}

	set reset(reset) {
		this.$set({ reset });
		flush();
	}

	get set_timer() {
		return this.$$.ctx[1];
	}

	set set_timer(set_timer) {
		this.$set({ set_timer });
		flush();
	}

	get wrong_list() {
		return this.$$.ctx[5];
	}

	set wrong_list(wrong_list) {
		this.$set({ wrong_list });
		flush();
	}

	get correct_list() {
		return this.$$.ctx[6];
	}

	set correct_list(correct_list) {
		this.$set({ correct_list });
		flush();
	}

	get set_wrong() {
		return this.$$.ctx[7];
	}

	set set_wrong(value) {
		throw new Error("<Bar>: Cannot set read-only property 'set_wrong'");
	}

	get set_correct() {
		return this.$$.ctx[8];
	}

	set set_correct(value) {
		throw new Error("<Bar>: Cannot set read-only property 'set_correct'");
	}

	get get_timer() {
		return this.$$.ctx[9];
	}

	set get_timer(value) {
		throw new Error("<Bar>: Cannot set read-only property 'get_timer'");
	}
}

/* src/App.svelte generated by Svelte v3.35.0 */

const { console: console_1 } = globals;
const file = "src/App.svelte";

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[18] = list[i];
	return child_ctx;
}

// (127:2) {#each allTheFish.itemListElement as row}
function create_each_block(ctx) {
	let figure;
	let img;
	let img_src_value;
	let img_data_answer_value;
	let img_alt_value;
	let t0;
	let a;
	let t1;
	let a_href_value;
	let t2;
	let figcaption;
	let t3_value = /*row*/ ctx[18].item.name + "";
	let t3;
	let t4;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			figure = element("figure");
			img = element("img");
			t0 = space();
			a = element("a");
			t1 = text("W");
			t2 = space();
			figcaption = element("figcaption");
			t3 = text(t3_value);
			t4 = space();
			attr_dev(img, "loading", "lazy");
			attr_dev(img, "width", "200");
			attr_dev(img, "class", "image svelte-1tjmkw");
			if (img.src !== (img_src_value = /*row*/ ctx[18].item.image.thumbnail.contentUrl)) attr_dev(img, "src", img_src_value);
			attr_dev(img, "data-answer", img_data_answer_value = /*row*/ ctx[18].item.name);
			attr_dev(img, "alt", img_alt_value = /*row*/ ctx[18].item.name);
			add_location(img, file, 128, 4, 3576);
			attr_dev(a, "class", "wiki svelte-1tjmkw");
			attr_dev(a, "rel", "noreferrer nofollow");
			attr_dev(a, "target", "_blank");
			attr_dev(a, "href", a_href_value = /*row*/ ctx[18].item.url);
			add_location(a, file, 129, 4, 3729);
			attr_dev(figcaption, "data-search", "");
			attr_dev(figcaption, "class", "desc svelte-1tjmkw");
			add_location(figcaption, file, 130, 4, 3821);
			attr_dev(figure, "class", "" + (null_to_empty(/*current*/ ctx[3] === "correct" ? "js--correct" : "") + " svelte-1tjmkw"));
			add_location(figure, file, 127, 3, 3487);
		},
		m: function mount(target, anchor) {
			insert_dev(target, figure, anchor);
			append_dev(figure, img);
			append_dev(figure, t0);
			append_dev(figure, a);
			append_dev(a, t1);
			append_dev(figure, t2);
			append_dev(figure, figcaption);
			append_dev(figcaption, t3);
			append_dev(figure, t4);

			if (!mounted) {
				dispose = listen_dev(figure, "click", /*handleClick*/ ctx[4], false, false, false);
				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*allTheFish*/ 1 && img.src !== (img_src_value = /*row*/ ctx[18].item.image.thumbnail.contentUrl)) {
				attr_dev(img, "src", img_src_value);
			}

			if (dirty & /*allTheFish*/ 1 && img_data_answer_value !== (img_data_answer_value = /*row*/ ctx[18].item.name)) {
				attr_dev(img, "data-answer", img_data_answer_value);
			}

			if (dirty & /*allTheFish*/ 1 && img_alt_value !== (img_alt_value = /*row*/ ctx[18].item.name)) {
				attr_dev(img, "alt", img_alt_value);
			}

			if (dirty & /*allTheFish*/ 1 && a_href_value !== (a_href_value = /*row*/ ctx[18].item.url)) {
				attr_dev(a, "href", a_href_value);
			}

			if (dirty & /*allTheFish*/ 1 && t3_value !== (t3_value = /*row*/ ctx[18].item.name + "")) set_data_dev(t3, t3_value);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(figure);
			mounted = false;
			dispose();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_each_block.name,
		type: "each",
		source: "(127:2) {#each allTheFish.itemListElement as row}",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let bar;
	let t0;
	let div;
	let t1;
	let progress;
	let current;
	let bar_props = {};
	bar = new Bar({ props: bar_props, $$inline: true });
	/*bar_binding*/ ctx[6](bar);
	let each_value = /*allTheFish*/ ctx[0].itemListElement;
	validate_each_argument(each_value);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	let progress_props = {};
	progress = new Progress({ props: progress_props, $$inline: true });
	/*progress_binding*/ ctx[7](progress);

	const block = {
		c: function create() {
			create_component(bar.$$.fragment);
			t0 = space();
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			create_component(progress.$$.fragment);
			attr_dev(div, "class", "content svelte-1tjmkw");
			add_location(div, file, 125, 1, 3418);
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			mount_component(bar, target, anchor);
			insert_dev(target, t0, anchor);
			insert_dev(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div, null);
			}

			insert_dev(target, t1, anchor);
			mount_component(progress, target, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			const bar_changes = {};
			bar.$set(bar_changes);

			if (dirty & /*current, handleClick, allTheFish*/ 25) {
				each_value = /*allTheFish*/ ctx[0].itemListElement;
				validate_each_argument(each_value);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			const progress_changes = {};
			progress.$set(progress_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(bar.$$.fragment, local);
			transition_in(progress.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(bar.$$.fragment, local);
			transition_out(progress.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			/*bar_binding*/ ctx[6](null);
			destroy_component(bar, detaching);
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(div);
			destroy_each(each_blocks, detaching);
			if (detaching) detach_dev(t1);
			/*progress_binding*/ ctx[7](null);
			destroy_component(progress, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

const questionsInterval = 15000;
const HIGHTLIHT_WRONG = 5000;

function shuffle(a) {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}

	return a;
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots("App", slots, []);
	let allTheFish = { itemListElement: [] };
	let { name } = $$props;
	let quiz_data = [];
	let cycle = 0;
	let correct = 0;
	let wrong = 0;
	let current = "";
	let interval = {};
	let parent_node_name = "figure";
	let prgs;
	let bb;

	function handleClick(ev) {
		let answer = ev.target.getAttribute("data-answer");
		console.log("clicked " + answer);

		if (answer === bb.question) {
			ev.target.parentNode.classList.add("correct");
			correct++;
			bb.set_correct(answer);
			quiz_data.splice(cycle - 1, 1);
			startTimerQuestions();
		} else {
			bb.set_wrong(bb.question, answer);
			ev.target.closest(parent_node_name).classList.add("js--wrong_answer");

			setTimeout(
				() => {
					ev.target.closest(parent_node_name).classList.remove("js--wrong_answer");
				},
				HIGHTLIHT_WRONG
			);

			wrong++;
		}

		if (correct === allTheFish.itemListElement.length) {
			console.log("correct:", correct);
			stopQuestionsAndWin();
			$$invalidate(2, bb.set_timer = false, bb);
		}

		return answer;
	}

	function cycleText() {
		if (quiz_data.length <= cycle) {
			cycle = 0;
			quiz_data = shuffle(quiz_data);
			console.log(quiz_data.length, "reset");
		}

		if (quiz_data.length) {
			$$invalidate(2, bb.question = quiz_data[cycle].item.name, bb);
		}

		cycle++;
	}

	function stopQuestionsAndWin() {
		console.log("Win");
		clearInterval(interval);
		prgs.store_progress({ collectionName: allTheFish.name });

		//bb_helper.progress_request(data);
		$$invalidate(2, bb.question = "Excellent !", bb);

		document.body.classList.add("bg-correct");
	}

	function startTimerQuestions() {
		clearInterval(interval);
		cycleText();
		$$invalidate(2, bb.set_timer = true, bb);
		interval = window.setInterval(cycleText, questionsInterval);
	}

	function start() {
		document.getElementById("run").classList.remove("js--hidden_btn_run");

		document.getElementById("run").addEventListener("click", () => {
			console.log("start pressed");
			cycle = 0;
			correct = 0;
			wrong = 0;
			$$invalidate(2, bb.reset = true, bb);
			$$invalidate(1, prgs.show = false, prgs);
			document.body.classList.remove("bg-correct");
			quiz_data = shuffle(allTheFish.itemListElement.slice());

			// let $img = document.getElementsByClassName('image');
			let img = [...document.querySelectorAll("[data-search]")];

			img.map(el => el.classList.toggle("js--hidden_answer"));

			// let $imgNames = [...document.querySelectorAll('[data-search]')];
			[].forEach.call(img, el => el.parentNode.classList.remove("correct"));

			startTimerQuestions();
		});
	}

	onMount(async () => {
		console.log("start plugin:", name);

		// fetch('/assets/jsonld/20-Fish_of_Australia.json')
		// fetch('/assets/jsonld/18-Parrot_stubs.json')
		// fetch('/assets/jsonld/6-Mięśnie_człowieka.json')
		// fetch('/assets/jsonld/303-Nato_Army_officers.json')
		// fetch('/assets/jsonld/56-Muscles_of_the_upper_limb.json')
		fetch("/assets/jsonld/142-Food_and_drink_paintings.json").then(r => r.json()).then(data => {
			$$invalidate(0, allTheFish = data);
			quiz_data = shuffle(data.itemListElement.slice());
		});

		document.addEventListener("DOMContentLoaded", start);
	});

	const writable_props = ["name"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
	});

	function bar_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			bb = $$value;
			$$invalidate(2, bb);
		});
	}

	function progress_binding($$value) {
		binding_callbacks[$$value ? "unshift" : "push"](() => {
			prgs = $$value;
			$$invalidate(1, prgs);
		});
	}

	$$self.$$set = $$props => {
		if ("name" in $$props) $$invalidate(5, name = $$props.name);
	};

	$$self.$capture_state = () => ({
		onMount,
		Progress,
		Bar,
		allTheFish,
		name,
		questionsInterval,
		HIGHTLIHT_WRONG,
		quiz_data,
		cycle,
		correct,
		wrong,
		current,
		interval,
		parent_node_name,
		prgs,
		bb,
		handleClick,
		shuffle,
		cycleText,
		stopQuestionsAndWin,
		startTimerQuestions,
		start
	});

	$$self.$inject_state = $$props => {
		if ("allTheFish" in $$props) $$invalidate(0, allTheFish = $$props.allTheFish);
		if ("name" in $$props) $$invalidate(5, name = $$props.name);
		if ("quiz_data" in $$props) quiz_data = $$props.quiz_data;
		if ("cycle" in $$props) cycle = $$props.cycle;
		if ("correct" in $$props) correct = $$props.correct;
		if ("wrong" in $$props) wrong = $$props.wrong;
		if ("current" in $$props) $$invalidate(3, current = $$props.current);
		if ("interval" in $$props) interval = $$props.interval;
		if ("parent_node_name" in $$props) parent_node_name = $$props.parent_node_name;
		if ("prgs" in $$props) $$invalidate(1, prgs = $$props.prgs);
		if ("bb" in $$props) $$invalidate(2, bb = $$props.bb);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*name*/ 32) {
			{
				console.log(`${name}`);
			}
		}
	};

	return [
		allTheFish,
		prgs,
		bb,
		current,
		handleClick,
		name,
		bar_binding,
		progress_binding
	];
}

class App extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance, create_fragment, safe_not_equal, { name: 5 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "App",
			options,
			id: create_fragment.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*name*/ ctx[5] === undefined && !("name" in props)) {
			console_1.warn("<App> was created without expected prop 'name'");
		}
	}

	get name() {
		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set name(value) {
		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

const app = new App({
	target: document.getElementsByTagName('main')[0],
	props: {
		name: 'rutynka_svald_wiki_basic',
	}
});

export default app;
