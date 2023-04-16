"use strict";

const { Clutter, Gio, GObject, St, Gvc, GLib } = imports.gi;
const PopupMenu = imports.ui.popupMenu;
const QuickSettings = imports.ui.quickSettings;
const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;
const Volume = imports.ui.status.volume;
const { Slider } = imports.ui.slider;

const VolumeMixerMenuItem = class extends PopupMenu.PopupBaseMenuItem {
    static {
        GObject.registerClass(this);
    }

    _init(stream) {
        super._init({
            activate: false,
            reactive: false,
        });
        this._control = Volume.getMixerControl();
        this._stream = stream;

        const box = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(box);

        const label = new St.Label({
            text: stream.get_name(),
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: false,
            style: "color: white;",
        });
        box.add_child(label);

        this._slider = new QuickSettings.QuickSlider({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        box.add_child(this._slider);
        this._slider._iconButton.visible = false;

        this._binding = this._stream.bind_property_full("volume", this._slider.slider, "value", GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
            (_, value) => [true, value / this._control.get_vol_max_norm()],
            (_, value) => {
                const prevMuted = this._stream.is_muted;
                let volume = value * this._control.get_vol_max_norm();
                if (volume < 1) {
                    volume = 0;
                    if (!prevMuted) this._stream.change_is_muted(true);
                } else if (prevMuted) this._stream.change_is_muted(false);
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, () => {
                    this._stream.push_volume();
                    return GLib.SOURCE_REMOVE;
                });
                return [true, volume];
            }
        );
        this.connect("destroy", () => this._binding.unbind());
    }
}

const VolumeMixerToggle = class extends QuickSettings.QuickToggle {
    static {
        GObject.registerClass(this);
    }

    _init() {
        super._init({
            title: "Volume Mixer",
            hasMenu: true,
            iconName: "go-next-symbolic",
        });
        this.add_style_class_name("background-apps-quick-toggle");
        this._box.set_child_above_sibling(this._icon, null);
        this.menu.setHeader("multimedia-volume-control-symbolic", "Volume Mixer");

        this._applicationStreams = {};
        this._control = Volume.getMixerControl();
        this._streamAddedEventId = this._control.connect("stream-added", this._streamAdded.bind(this));
        this._streamRemovedEventId = this._control.connect("stream-removed", this._streamRemoved.bind(this));

        for (const stream of this._control.get_streams()) this._streamAdded(this._control, stream.get_id());
        this.visible = Object.keys(this._applicationStreams).length > 0;

        this.connect("destroy", () => {
            if (this._streamAddedEventId) this._control.disconnect(this._streamAddedEventId);
            if (this._streamRemovedEventId) this._control.disconnect(this._streamRemovedEventId);
        });
    }

    vfunc_clicked() {
        this.menu.open();
    }

    _streamAdded(control, id) {
        if (id in this._applicationStreams) return;
        const stream = control.lookup_stream_id(id);
        if (stream.is_event_stream || !(stream instanceof Gvc.MixerSinkInput)) return;
        this._applicationStreams[id] = new VolumeMixerMenuItem(stream);
        this.menu.addMenuItem(this._applicationStreams[id]);
        this.visible = true;
        const count = Object.keys(this._applicationStreams).length;
        this.title = `Volume Mixer - ${count === 1 ? "1 stream" : `${count} streams`}`;
    }

    _streamRemoved(_control, id) {
        if (id in this._applicationStreams) {
            this._applicationStreams[id].destroy();
            delete this._applicationStreams[id];
            const count = Object.keys(this._applicationStreams).length;
            if (count === 0) this.visible = false;
            else this.title = `Volume Mixer - ${count === 1 ? "1 stream" : `${count} streams`}`;
        }
    }
}

var VolumeMixerIndicator = class extends QuickSettings.SystemIndicator {
    static {
        GObject.registerClass(this);
    }

    _init() {
        super._init();
        this.quickSettingsItems.push(new VolumeMixerToggle());
        QuickSettingsMenu._addItems(this.quickSettingsItems, 2);
        for (const item of this.quickSettingsItems) QuickSettingsMenu.menu._grid.set_child_above_sibling(item, QuickSettingsMenu._volume._input);
        this.connect("destroy", () => this.quickSettingsItems.forEach(item => item.destroy()));
    }
}