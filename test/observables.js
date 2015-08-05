var mobservable = require('mobservable');

var value = mobservable.value;
var voidObserver = function(){};

function buffer() {
    var b = [];
    var res = function(newValue) {
        b.push(newValue);
    };
    res.toArray = function() {
        return b;
    }
    return res;
}

exports.basic = function(test) {
    var x = mobservable(3);
    var b = buffer();
    x.observe(b);
    test.equal(3, x());

    x(5);
    test.equal(5, x());
    test.deepEqual([5], b.toArray());
    test.equal(mobservable._.stackDepth(), 0);
    test.done();
}

exports.basic2 = function(test) {
    var x = value(3);
    var z = value(function () { return x() * 2});
    var y = value(function () { return x() * 3});

    z.observe(voidObserver);

    test.equal(z(), 6);
    test.equal(y(), 9);

    x(5);
    test.equal(z(), 10);
    test.equal(y(), 15);

    test.equal(mobservable._.stackDepth(), 0);
    test.done();
}

exports.dynamic = function(test) {
    try {
        var x = mobservable.primitive(3);
        var y = mobservable.computed(function() {
            return x();
        });
        var b = buffer();
        y.observe(b, true);

        test.equal(3, y()); // First evaluation here..

        x(5);
        test.equal(5, y());

        test.deepEqual([3, 5], b.toArray());
        test.equal(mobservable._.stackDepth(), 0);

        test.done();
    }
    catch(e) {
        console.log(e.stack);
    }
}

exports.dynamic2 = function(test) {
    try {
        var x = value(3);
        var y = value(function() {
            return x() * x();
        });

        test.equal(9, y());
        var b = buffer();
        y.observe(b);

        x(5);
        test.equal(25, y());

        //no intermediate value 15!
        test.deepEqual([25], b.toArray());
        test.equal(mobservable._.stackDepth(), 0);

        test.done();
    }
    catch(e) {
        console.log(e.stack);
    }
}

exports.readme1 = function(test) {
    try {
        var b = buffer();

        var vat = value(0.20);
        var order = {};
        order.price = value(10);
        // Prints: New price: 24
        //in TS, just: value(() => this.price() * (1+vat()))
        order.priceWithVat = value(function() {
            return order.price() * (1+vat());
        });

        order.priceWithVat.observe(b);

        order.price(20);
        order.price(10);
        test.deepEqual([24,12],b.toArray());
        test.equal(mobservable._.stackDepth(), 0);

        test.done();
    } catch (e) {
        console.log(e.stack); throw e;
    }
}

exports.testBatch = function(test) {
    var a = value(2);
    var b = value(3);
    var c = value(function() { return a() * b() });
    var d = value(function() { return c() * b() });
    var buf = buffer();
    d.observe(buf);

    a(4);
    b(5);
    // Note, 60 should not happen! (that is d beign computed before c after update of b)
    test.deepEqual([36, 100], buf.toArray());

    var x = mobservable.batch(function() {
        a(2);
        b(3);
        a(6);
        test.deepEqual(100, d()); // still hunderd
        return 2;
    });

    test.equal(x, 2); // test return value
    test.deepEqual([36, 100, 54], buf.toArray());// only one new value for d
    test.done();
}

exports.testScope = function(test) {
    var vat = value(0.2);
    var Order = function() {
        this.price = value(20, this);
        this.amount = value(2, this);
        this.total = value(function() {
            return (1+vat()) * this.price() * this.amount();
        }, this);
    };

    var order = new Order();
    order.total.observe(voidObserver);
    order.price(10);
    order.amount(3);
    test.equals(36, order.total());
    test.equal(mobservable._.stackDepth(), 0);

    test.done();
}

exports.testProps1 = function(test) {
    var vat = value(0.2);
    var Order = function() {
        mobservable.props(this, 'price', 20);
        mobservable.props(this, 'amount', 2);
        mobservable.props(this, 'total', function() {
            return (1+vat()) * this.price * this.amount; // price and amount are now properties!
        });
    };

    var order = new Order();
    test.equals(48, order.total);
    order.price = 10;
    order.amount = 3;
    test.equals(36, order.total);

    var totals = [];
    var sub = mobservable.observeProperty(order, 'total', function(value) {
        totals.push(value);
    }, true);
    order.amount = 4;
    sub();
    order.amount = 5;
    test.deepEqual(totals, [36,48]);

    test.equal(mobservable._.stackDepth(), 0);
    test.done();
};

exports.testProps2 = function(test) {
    var vat = value(0.2);
    var Order = function() {
        mobservable.props(this, {
            price: 20,
            amount: 2,
            total: function() {
                return (1+vat()) * this.price * this.amount; // price and amount are now properties!
            }
        });
    };

    var order = new Order();
    test.equals(48, order.total);
    order.price = 10;
    order.amount = 3;
    test.equals(36, order.total);
    test.done();
};

exports.testProps3 = function(test) {
    var vat = value(0.2);
    var Order = function() {
        this.price = 20;
        this.amount = 2;
        this.total = function() {
            return (1+vat()) * this.price * this.amount; // price and amount are now properties!
        };
        mobservable.props(this, this);
    };

    var order = new Order();
    test.equals(48, order.total);
    order.price = 10;
    order.amount = 3;
    test.equals(36, order.total);
    test.done();
};

exports.testProps4 = function(test) {
    function Bzz() {
        mobservable.props(this, {
            fluff: [1,2],
            sum: function() {
                return this.fluff.reduce(function(a,b) {
                    return a + b;
                }, 0);
            }
        });
    }

    var x = new Bzz();
    var ar = x.fluff;
    test.equal(x.sum, 3);
    x.fluff.push(3);
    test.equal(x.sum, 6);
    x.fluff = [5,6];
    test.equal(x.sum, 11);
    x.fluff.push(2);
    test.equal(x.sum, 13);
    test.done();
}


exports.testObserveProperty = function(test) {
    var sb = [];
    var mb = [];
    
    var Wrapper = function (chocolateBar) {
        mobservable.props(this, {
            chocolateBar: chocolateBar,
            calories: function () {
                return this.chocolateBar.calories;
            }
        });
    };

    var snickers = mobservable.props({
        calories: null
    });
    var mars = mobservable.props({
        calories: undefined
    });

    var wrappedSnickers = new Wrapper(snickers);
    var wrappedMars = new Wrapper(mars);

    var disposeSnickers = mobservable.observeProperty(wrappedSnickers, 'calories', function (calories) {
        sb.push(calories);
    }, true);
    var disposeMars = mobservable.observeProperty(wrappedMars, 'calories', function (calories) {
        mb.push(calories);
    }, true);
    snickers.calories = 10;
    mars.calories = 15;

    disposeSnickers();
    disposeMars();
    snickers.calories = 5;
    mars.calories = 7;

    test.deepEqual(sb, [null, 10]);
    test.deepEqual(mb, [undefined, 15]);

    test.done();
}

exports.testWatch = function(test) {
    var a = value(3);
    var b = value(2);
    var changed = 0;
    var calcs = 0;
    var res = mobservable.watch(function() {
        calcs += 1;
        return a() * b();
    }, function() {
        changed += 1;
    });

    test.equals(2, res.length);
    test.equals(6, res[0]);
    test.equals(changed, 0);
    test.equals(calcs, 1);
    test.equals(a.impl.dependencyState.observers.length, 1);
    test.equals(b.impl.dependencyState.observers.length, 1);
    
    b(4);
    test.equals(changed, 1);
    test.equals(calcs, 1); // no more calcs!
    test.equals(a.impl.dependencyState.observers.length, 0);
    test.equals(b.impl.dependencyState.observers.length, 0);

    test.equal(mobservable._.stackDepth(), 0);
    test.done();
}

exports.testWatchDisposed = function(test) {
    var a = value(3);
    var b = value(2);
    var changed = 0;
    var calcs = 0;
    var res = mobservable.watch(function() {
        calcs += 1;
        return a() * b();
    }, function() {
        changed += 1;
    });

    test.equals(2, res.length);
    test.equals(6, res[0]);
    test.equals(changed, 0);
    test.equals(calcs, 1);

    res[1](); //cleanup
    b(4);
    test.equals(changed, 0); // onInvalidate should not trigger during explicit cleanup
    test.equals(calcs, 1);

    test.equal(mobservable._.stackDepth(), 0);
    test.done();
}

exports.testWatchNested = function(test) {
    var bCalcs = 0, cCalcs = 0, dCalcs = 0;
    var a = value(3);
    var b, c;
    value(function() {
        bCalcs += 1;
        c = mobservable.watch(function() {
            cCalcs += 1;
            return a();
        }, function() {
            dCalcs += 1;
        });
        return c[0];
        
    }).observe(function(newValue) {
        b = newValue;  
    }, true);

    test.equal(b, 3);
    test.equal(c[0], 3);
    test.equal(cCalcs, 1);
    test.equal(dCalcs, 0);
    test.equal(bCalcs, 1);

    a(4); // doesn't affect anything outside the watch!
    test.equal(c[0], 3);
    test.equal(b, 3);
    test.equal(cCalcs, 1);
    test.equal(dCalcs, 1);
    test.equal(bCalcs, 1);

    test.done();
};

exports.testChangeCountOptimization = function(test) {
    var bCalcs = 0;
    var cCalcs = 0;
    var a = value(3);
    var b = value(function() {
        bCalcs += 1;
        return 4 + a() - a();
    });
    var c = value(function() {
        cCalcs += 1;
        return b();
    });

    c.observe(voidObserver);

    test.equals(b(), 4);
    test.equals(c(), 4);
    test.equals(bCalcs, 1);
    test.equals(cCalcs, 1);

    a(5);

    test.equals(b(), 4);
    test.equals(c(), 4);
    test.equals(bCalcs, 2);
    test.equals(cCalcs, 1);

    test.equal(mobservable._.stackDepth(), 0);
    test.done();
}

exports.testObservablesRemoved = function(test) {
    var calcs = 0;
    var a = value(1);
    var b = value(2);
    var c = value(function() {
        calcs ++;
        if (a() === 1)
        return b() * a() * b();
        return 3;
    });


    test.equals(calcs, 0);
    c.observe(voidObserver);
    test.equals(c(), 4);
    test.equals(calcs, 1);
    a(2);
    test.equals(c(), 3);
    test.equals(calcs, 2);

    b(3); // should not retrigger calc
    test.equals(c(), 3);
    test.equals(calcs, 2);

    a(1);
    test.equals(c(), 9);
    test.equals(calcs, 3);

    test.equal(mobservable._.stackDepth(), 0);
    test.done();
}


exports.testLazyEvaluation = function (test) {
    var bCalcs = 0;
    var cCalcs = 0;
    var dCalcs = 0;
    var observerChanges = 0;

    var a = value(1);
    var b = value(function() {
        bCalcs += 1;
        return a() +1;
    });

    var c = value(function() {
        cCalcs += 1;
        return b() +1;
    });

    test.equal(bCalcs, 0);
    test.equal(cCalcs, 0);
    test.equal(c(), 3);
    test.equal(bCalcs,1);
    test.equal(cCalcs,1);

    test.equal(c(), 3);
    test.equal(bCalcs,2);
    test.equal(cCalcs,2);

    a(2);
    test.equal(bCalcs,2);
    test.equal(cCalcs,2);

    test.equal(c(), 4);
    test.equal(bCalcs,3);
    test.equal(cCalcs,3);

    var d = value(function() {
        dCalcs += 1;
        return b() * 2;
    });

    var handle = d.observe(function() {
        observerChanges += 1;
    }, false);
    test.equal(bCalcs,4);
    test.equal(cCalcs,3);
    test.equal(dCalcs,1); // d is evaluated, so that its dependencies are known

    a(3);
    test.equal(d(), 8);
    test.equal(bCalcs,5);
    test.equal(cCalcs,3);
    test.equal(dCalcs,2);

    test.equal(c(), 5);
    test.equal(bCalcs,5);
    test.equal(cCalcs,4);
    test.equal(dCalcs,2);

    test.equal(b(), 4);
    test.equal(bCalcs,5);
    test.equal(cCalcs,4);
    test.equal(dCalcs,2);

    handle(); // unlisten
    test.equal(d(), 8);
    test.equal(bCalcs,6); // gone to sleep
    test.equal(cCalcs,4);
    test.equal(dCalcs,3);

    test.equal(observerChanges, 1);

    test.equal(mobservable._.stackDepth(), 0);
    test.done();
};

exports.testToPlainValue = function(test) {
    var n = null;
    var a = 3;
    var b = mobservable(3);
    var c = mobservable.array([1,2,3]);
    var d = mobservable.props({
        a: 1,
        b: [1,2,3],
        c: function() { return this.a * 2; }
    });
    var e = [4,5,6];
    var p = mobservable.toPlainValue;

    test.equal(p(n), null);
    test.equal(p(a), 3);
    test.equal(p(b), 3);
    test.deepEqual(p(c), [1,2,3]);
    test.deepEqual(p(d), { a: 1, b:[1,2,3],c:2 });
    test.deepEqual(p(e), [4,5,6]);

    var pb = p(b);
    var pc = p(c);
    var pd = p(d);
    var pe = p(e);

    // changes should not become visible in clones
    b(2);
    c[0] = 4;
    d.a = 2;
    d.b.push(4);
    e.shift();

    test.equal(b(), 2);
    test.equal(pb, 3);
    test.deepEqual(c, [4,2,3]);
    test.deepEqual(pc, [1,2,3]);
    test.deepEqual(d, {a:2, b:[1,2,3,4],c:4});
    test.deepEqual(pd, {a:1, b:[1,2,3],c:2});
    test.deepEqual(e, [5,6]);
    test.deepEqual(pe, [4,5,6]);

    // And vice versa
    pd.a = 3;
    pe.push(7); 
    test.deepEqual(d, {a:2, b:[1,2,3,4],c:4});
    test.deepEqual(pd, {a:3, b:[1,2,3],c:2});

    test.deepEqual(e, [5,6]);
    test.deepEqual(pe, [4,5,6,7]);

    test.done();
};

exports.test_nested_observable = function(test) {
    var factor = mobservable(50);
    
    var price = mobservable(100);
    
    var total = mobservable(function() {
       return price() * mobservable(function() {
           return 1 + (factor() / 100);
       })();
    });
    
    test.equal(total(), 150);
    price(200);
    test.equal(total(), 300);
    factor(100);
    test.equal(total(), 400);
    test.equal(factor.impl.dependencyState.observers.length, 0);
    test.equal(total.impl.dependencyState.observing.length, 0);
    
    var b = [];
    var sub = total.observe(function(v) {
        b.push(v);
    });
    price(100);
    factor(50);
    price(200);
    factor(100);
    
    test.deepEqual(b, [200, 150, 300, 400]);
    // changes over time didn't increase number of observers
    test.equal(factor.impl.dependencyState.observers.length, 1);
    test.equal(price.impl.dependencyState.observers.length, 1);
    test.equal(total.impl.dependencyState.observing.length, 2);
    
    sub();
    // and everything is cleaned up properly
    test.equal(factor.impl.dependencyState.observers.length, 0);
    test.equal(price.impl.dependencyState.observers.length, 0);
    test.equal(total.impl.dependencyState.observing.length, 0);
    
    test.done();
};

exports.test_nested_observable2 = function(test) {
    var factor = mobservable(0);
    var price = mobservable(100);
    var totalCalcs = 0;
    var innerCalcs = 0;
    
    var total = mobservable(function() {
        totalCalcs += 1; // outer observable shouldn't recalc if inner observable didn't publish a real change
        return price() * mobservable(function() {
            innerCalcs += 1;
            return factor() % 2 === 0 ? 1 : 3;
        })();
    });
    
    var b = [];
    var sub = total.observe(function(x) { b.push(x); }, true);
    
    price(150);
    factor(7); // triggers innerCalc twice, because changing the outcome triggers the outer calculation which recreates the inner calculation
    factor(5); // doesn't trigger outer calc
    factor(3); // doesn't trigger outer calc
    factor(4); // triggers innerCalc twice
    price(20);
    
    test.deepEqual(b, [100,150,450,150,20]);
    test.equal(innerCalcs, 9);
    test.equal(totalCalcs, 5);    
    
    test.done();
}; 

exports.test_expr = function(test) {
    var factor = mobservable(0);
    var price = mobservable(100);
    var totalCalcs = 0;
    var innerCalcs = 0;
    
    var total = mobservable(function() {
        totalCalcs += 1; // outer observable shouldn't recalc if inner observable didn't publish a real change
        return price() * mobservable.expr(function() {
            innerCalcs += 1;
            return factor() % 2 === 0 ? 1 : 3;
        });
    });
    
    var b = [];
    var sub = total.observe(function(x) { b.push(x); }, true);
    
    price(150);
    factor(7); // triggers innerCalc twice, because changing the outcome triggers the outer calculation which recreates the inner calculation
    factor(5); // doesn't trigger outer calc
    factor(3); // doesn't trigger outer calc
    factor(4); // triggers innerCalc twice
    price(20);
    
    test.deepEqual(b, [100,150,450,150,20]);
    test.equal(innerCalcs, 9);
    test.equal(totalCalcs, 5);    
    
    test.throws(function() {
        mobservable.expr(function() { return 1; });
    }, "mobservable.expr can only be used inside a computed observable");
    
    test.done();
}; 

exports.test_sideeffect = function(test) {
    var x = mobservable(3);
    var x2 = mobservable(function() { return x() * 2; });
    var b = [];
    
    var cancel = mobservable.sideEffect(function() { 
        b.push(x2()); 
    });
    
    x(4);
    x(5);
    test.deepEqual(b, [6, 8, 10]);
    cancel();
    x(7);
    test.deepEqual(b, [6, 8, 10]);
    
    test.done();
};

exports.test_json1 = function(test) {
    var todos = mobservable.fromJson([
        {
            title: "write blog"
        },
        {
            title: "improve coverge"
        }    
    ]);
    
    var output;
    mobservable.sideEffect(function() {
        output = todos.map(function(todo) { return todo.title; }).join(", ");
    });
    
    todos[1].title = "improve coverage"; // prints: write blog, improve coverage
    test.equal(output, "write blog, improve coverage");
    todos.push({ title: "take a nap" }); // prints: write blog, improve coverage, take a nap
    test.equal(output, "write blog, improve coverage, take a nap");
    
    test.done();
}

exports.test_json2 = function(test) {
    var source = {
        todos: [
            {
                title: "write blog",
                tags: ["react","frp"],
                details: {
                    url: "somewhere"
                }
            },
            {
                title: "do the dishes",
                tags: ["mweh"],
                details: {
                    url: "here"
                }
            }
        ]
    };
    
    var o = mobservable.fromJson(source);
    
    //console.log(JSON.stringify(source,null,4));
    test.deepEqual(mobservable.toJson(o), source);
    test.deepEqual(source, o);
        
    var analyze = mobservable(function() {
        return [
            o.todos.length,
            o.todos[1].details.url
        ]
    });
    
    var alltags = mobservable(function() {
        return o.todos.map(function(todo) {
            return todo.tags.join(",");
        }).join(",");
    });
    
    var ab = [];
    var tb = [];
    
    analyze.observe(function(d) { ab.push(d); }, true);
    alltags.observe(function(d) { tb.push(d); }, true);
    
    o.todos[0].details.url = "boe";
    o.todos[1].details.url = "ba";
    o.todos[0].tags[0] = "reactjs";
    o.todos[1].tags.push("pff");
    
    test.deepEqual(mobservable.toJson(o), {
        "todos": [
            {
                "title": "write blog",
                "tags": [
                    "reactjs",
                    "frp"
                ],
                "details": {
                    "url": "boe"
                }
            },
            {
                "title": "do the dishes",
                "tags": [
                    "mweh", "pff"
                ],
                "details": {
                    "url": "ba"
                }
            }
        ]
    });
    test.deepEqual(ab, [ [ 2, 'here' ], [ 2, 'ba' ] ]);
    test.deepEqual(tb,  [ 'react,frp,mweh', 'reactjs,frp,mweh', 'reactjs,frp,mweh,pff' ]);
    ab = [];
    tb = [];
    
    o.todos.push(mobservable.fromJson({
        title: "test",
        tags: ["x"]
    }));
    
    test.deepEqual(o, {
        "todos": [
            {
                "title": "write blog",
                "tags": [
                    "reactjs",
                    "frp"
                ],
                "details": {
                    "url": "boe"
                }
            },
            {
                "title": "do the dishes",
                "tags": [
                    "mweh", "pff"
                ],
                "details": {
                    "url": "ba"
                }
            },
            {
                title: "test",
                tags: ["x"]
            }
        ]
    });
    test.deepEqual(ab, [[3, "ba"]]);
    test.deepEqual(tb, ["reactjs,frp,mweh,pff,x"]);
    ab = [];
    tb = [];

    o.todos[1] = mobservable.fromJson({
        title: "clean the attic",
        tags: ["needs sabbatical"],
        details: {
            url: "booking.com"
        }
    });
    test.deepEqual(o, {
        "todos": [
            {
                "title": "write blog",
                "tags": [
                    "reactjs",
                    "frp"
                ],
                "details": {
                    "url": "boe"
                }
            },
            {
                "title": "clean the attic",
                "tags": [
                    "needs sabbatical"
                ],
                "details": {
                    "url": "booking.com"
                }
            },
            {
                title: "test",
                tags: ["x"]
            }
        ]
    });
    test.deepEqual(ab, [[3, "booking.com"]]);
    test.deepEqual(tb, ["reactjs,frp,needs sabbatical,x"]);
    ab = [];
    tb = [];
    
    o.todos[1].details = mobservable.fromJson({ url: "google" });
    o.todos[1].tags = ["foo", "bar"];
    test.deepEqual(mobservable.toJson(o), {
         "todos": [
            {
                "title": "write blog",
                "tags": [
                    "reactjs",
                    "frp"
                ],
                "details": {
                    "url": "boe"
                }
            },
            {
                "title": "clean the attic",
                "tags": [
                    "foo", "bar"
                ],
                "details": {
                    "url": "google"
                }
            },
            {
                title: "test",
                tags: ["x"]
            }
        ]
    });
    test.deepEqual(o, mobservable.toJson(o));
    test.deepEqual(ab, [[3, "google"]]);
    test.deepEqual(tb, ["reactjs,frp,foo,bar,x"]);
    
    test.done();
}