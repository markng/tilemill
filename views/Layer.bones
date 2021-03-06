view = Backbone.View.extend();

view.prototype.events = {
    'click .layerFile input[type=submit]': 'saveFile',
    'click .layerPostGIS input[type=submit]': 'savePostGIS',
    'click .layerFile a[href=#open]': 'browseFile',
    'click .layerPostGIS a[href=#open]': 'browsePostGIS',
    'click a[href=#favorite]': 'favoriteToggle',
    'keyup input[name=file], input[name=connection]': 'favoriteUpdate',
    'change input[name=file], input[name=connection]': 'favoriteUpdate',
    'click a[href=#cacheFlush]': 'cacheFlush',
    'change select[name=srs-name]': 'nameToSrs',
    'keyup input[name=srs]': 'srsToName',
    'keyup input[name=file]': 'srsForce',
    'change input[name=file]': 'srsForce'
};

view.prototype.initialize = function(options) {
    if (!options.favorites) throw new Error('options.favorites required.');

    _(this).bindAll(
        'render',
        'saveFile',
        'savePostGIS',
        'browseFile',
        'browsePostGIS',
        'favoriteToggle',
        'favoriteUpdate',
        'cacheFlush',
        'nameToSrs',
        'srsToName',
        'srsForce'
    );
    this.favorites = options.favorites;
    this.render();
};

view.prototype.render = function() {
    this.$('.content').html(templates.Layer(this.model));

    // Quick easy way to check and set whether input
    // URI is favorited.
    this.$('input[name=file], input[name=connection]').change();

    if (this.model.get('Datasource')) {
        if (this.model.get('Datasource').file) {
            this.$('a[href=#layerFile]').click();
        } else if (this.model.get('Datasource').type == 'postgis') {
            this.$('a[href=#layerPostGIS]').click();
        }
    }

    // Autofocus first field for new layers.
    if (!this.model.id) this.$('input[type=text]:first').focus();
    return this;
};

view.prototype.nameToSrs = function(ev) {
    var el = $(ev.currentTarget);
    var name = $(ev.currentTarget).val();
    if (this.model.SRS[name]) {
        el.siblings('input[name=srs]').val(this.model.SRS[name]);
    } else if (name === 'autodetect') {
        el.siblings('input[name=srs]').val('');
    }
};

view.prototype.srsToName = function(ev) {
    var el = $(ev.currentTarget);
    var srs = $(ev.currentTarget).val();
    el.siblings('select[name=srs-name]').val(this.model.srsName(srs));
};

// Force raster and KML sources to use `autodetect` as their SRS. Actual SRS
// enforcement occurs upstream in `millstone`.
view.prototype.srsForce = function(ev) {
    var uri = $(ev.currentTarget).val();
    var form = $(ev.currentTarget).parents('form');
    var matches = uri.match(/.(\w+)$/) || [''];
    switch (matches[0]) {
    case '.geotiff':
    case '.geotif':
    case '.vrt':
    case '.tiff':
    case '.tif':
    case '.kml':
        $('select[name=srs-name], input[name=srs]', form).attr('disabled', true);
        $('select[name=srs-name]', form).val('autodetect').change();
        $('input[name=srs]', form).val('');
        break;
    default:
        $('select[name=srs-name], input[name=srs]', form).attr('disabled', false);
        $('select[name=srs-name]', form).change();
        break;
    }
};

view.prototype.favoriteToggle = function(ev) {
    var form = $(ev.currentTarget).parents('form');
    var uri = $('input[name=file], input[name=connection]', form).val();
    // @TODO wait for 'success'? Throw errors?
    if (this.favorites.get(uri)) {
        var model = this.favorites.get(uri);
        this.favorites.remove(uri);
        model.destroy();
        $(ev.currentTarget).removeClass('active');
    } else if (uri) {
        var model = new models.Favorite({id:uri});
        this.favorites.add(model);
        model.save();
        $(ev.currentTarget).addClass('active');
    }
    return false;
};

view.prototype.favoriteUpdate = function(ev) {
    var target = $(ev.currentTarget);
    var favorite = target.siblings('a.favorite');
    var uri = target.val();
    if (uri.match(/^(http:\/\/|(.+\s)?dbname=[\w]+)/)) {
        favorite.removeClass('hidden');
        if (this.favorites.isFavorite(uri)) {
            favorite.addClass('active');
        } else {
            favorite.removeClass('active');
        }
    } else {
        favorite.addClass('hidden');
    }

    // Show cache clear link if datasource points to a URL.
    var cache = target.siblings('.cache');
    if (uri.match(/^http:\/\//)) {
        cache.removeClass('hidden');
    } else {
        cache.addClass('hidden');
    }
    return false;
};

view.prototype.browseFile = function(ev) {
    var id = 'file';
    var target = $(ev.currentTarget);
    target.toggleClass('active');
    if (target.hasClass('active')) {
        target.text('Done');
    } else {
        target.text('Browse');
    }
    this.$('.layerFile ul.form').toggleClass('expand');

    if (target.is('.active')) (new models.Library({id:id})).fetch({
        success: _(function(model, resp) {
            new views.Library({
                model: model,
                favorites: this.favorites,
                input: this.$('.layerFile input[name=file]'),
                el: this.$('.layerFile .browser')
            });
        }).bind(this),
        error: function(model, err) { new views.Modal(err) }
    });
    return false;
};

view.prototype.browsePostGIS = function(ev) {
    var id = 'favoritesPostGIS';
    var target = $(ev.currentTarget);
    target.toggleClass('active');
    if (target.hasClass('active')) {
        target.text('Done');
    } else {
        target.text('Browse');
    }
    this.$('.layerPostGIS ul.form').toggleClass('expand');

    if (target.is('.active')) (new models.Library({id:id})).fetch({
        success: _(function(model, resp) {
            new views.Library({
                model: model,
                favorites: this.favorites,
                input: this.$('.layerPostGIS input[name=connection]'),
                el: this.$('.layerPostGIS .browser')
            });
        }).bind(this),
        error: function(model, err) { new views.Modal(err) }
    });
    return false;
};

view.prototype.saveFile = function() {
    $(this.el).addClass('loading');
    var attr = {
        'id':    this.$('input[name=id]').val(),
        'name':  this.$('input[name=id]').val(),
        'srs':   this.$('input[name=srs]').val(),
        'class': this.$('input[name=class]').val(),
        'Datasource': {
            'file': this.$('input[name=file]').val()
        }
    };
    var error = _(function(m, e) {
        $(this.el).removeClass('loading');
        new views.Modal(e);
    }).bind(this);
    this.model.validateAsync(attr, { success:_(function() {
        $(this.el).removeClass('loading');
        if (!this.model.set(attr, {error:error})) return;
        if (!this.model.collection.include(this.model))
            this.model.collection.add(this.model);
        this.$('.close').click();
    }).bind(this), error:error });
    return false;
};

view.prototype.savePostGIS = function() {
    $(this.el).addClass('loading');
    var connection = {};
    var error;
    var allowedArgs = ['username', 'password', 'dbname', 'port', 'host'];
    _(this.$('form.layerPostGIS input[name=connection]').val().split(' '))
        .each(function(argument) {
            var pair = argument.split('=');
            if (pair[0] && pair[1] && allowedArgs.indexOf(pair[0]) !== -1) {
                connection[pair[0]] = pair[1];
            } else {
                error = new Error('Invalid argument ' + pair[0] + ' in PostgreSQL connection string.');
            }
        });
    if (!error && !_(connection).size()) {
        error = new Error('Invalid PostgreSQL connection string.');
    } else if (!error && !connection.dbname) {
        error = new Error('dbname is required in PostgreSQL connection string.');
    }
    if (error) {
        $(this.el).removeClass('loading');
        new views.Modal(error);
        return false;
    }
    var attr = {
        'id':    this.$('form.layerPostGIS input[name=id]').val(),
        'name':  this.$('form.layerPostGIS input[name=id]').val(),
        'srs':   this.$('form.layerPostGIS input[name=srs]').val()
            || this.model.SRS['900913'],
        'class': this.$('form.layerPostGIS input[name=class]').val(),
        'Datasource': _({
            'table':    this.$('textarea[name=table]', this.el).val(),
            'key_field': this.$('input[name=key_field]', this.el).val(),
            'geometry_field': this.$('input[name=geometry_field]', this.el).val(),
            'extent':   this.$('input[name=extent]', this.el).val(),
            'type': 'postgis'
        }).extend(connection)
    };
    var error = _(function(m, e) {
        $(this.el).removeClass('loading');
        new views.Modal(e);
    }).bind(this);
    this.model.validateAsync(attr, { success:_(function() {
        $(this.el).removeClass('loading');
        if (!this.model.set(attr, {error:error})) return;
        if (!this.model.collection.include(this.model))
            this.model.collection.add(this.model);
        this.$('.close').click();
    }).bind(this), error:error });
    return false;
};

view.prototype.cacheFlush = function(ev) {
    $(this.el).addClass('loading');
    var url = this.$('form.layerFile input[name=file]').val();
    this.model.collection.parent.flush(this.model.id, url, {
        success: _(function(m, resp) {
            $(this.el).removeClass('loading');
        }).bind(this),
        error: _(function(m, err) {
            $(this.el).removeClass('loading');
            new views.Modal(err);
        }).bind(this)
    });
    return false;
};

