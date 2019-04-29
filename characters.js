// this is the main entry point for the character lineup

'use strict';

import { Scene } from './smge/game_objects/scene.js';
import { SpriteFont } from './smge/standalone/sprite_font.js';
import { SpringCameraCursor } from './spring_camera_cursor.js';
import { Text } from './smge/game_objects/text.js';
import { Overlay } from './smge/game_objects/overlay.js';
import { Bound } from './smge/bound_manager.js';
import { GameObject } from './smge/game_object.js';
import { Rect } from './smge/game_objects/rect.js';
import { Transform } from './smge/modules/transform.js';
import { Sprite } from './smge/modules/sprite.js';
import { Attach } from './smge/modules/attach.js';
import { TiledBackground } from './smge/game_objects/tiled_background.js';
import { Shaker } from './smge/modules/shaker.js';

// the main characters game object
// this will load in the font resources,
// create the spring camera cursor,
// and set up all character objects and interface menus
export class Characters extends Scene {
	constructor(smge) {
		super(
			smge, 
			{
				cover_color: '#000000',
				cover_type_in: 'cut',
				cover_duration_in: 1,
				cover_type_out: 'fade',
				cover_duration_out: 500,
				min_cover_duration: 50,
			}
		);
		// get characters data uri from querystring
		this.url_params = new URLSearchParams(window.location.search);
		this.characters_data_uri = this.url_params.get('data');
		if (!this.characters_data_uri) {
			alert('no character data file specified');
			this.smge.stop();
			return;
		}
		this.characters_data_uri += '?nocache' + new Date().getTime();
		this.characters_data = {};
		this.background_color = '#80808000';
		this.text_color = '#ffffff';
		this.camera_height = 80;
		this.select_sound = null;
		this.highlight_sound = null;
		this.highlight_color = '#d0d0d0';
		this.spacing = 8;
		this.pip_offset = 12;
		this.pip_maximum_swing = 1;
		this.pip_direction = 1;
		this.pip_impulse = 0.075;
		this.alternate_button_offset = 6;
		this.name_padding = 1;
		this.ui_padding = 4;
		this.details_padding = 12;
		this.focus_duration = 125;
		// storage
		this.creators = {};
		this.settings = {};
		this.characters = {};
		this.focused = '';
		this.filtered_characters = [];
		this.current_index = -1;
		this.selected_y_offset = 0;
		this.selected_scale = 1;
		this.camera_weight = 0.025;
		this.details = false;
	}
	load() {
		this.smge.resource_manager.load([
			{
				id: 'characters_data',
				type: 'json',
				url: this.characters_data_uri,
			},
		], () => {
			this.characters_data = this.smge.resource_manager.resources['characters_data'];
			// override properties
			let properties = [
				'background_color',
				'text_color',
				'camera_height',
				'spacing',
				'pip_offset',
				'pip_maximum_swing',
				'pip_impulse',
				'alternate_button_offset',
				'ui_padding',
				'title_padding',
				'details_padding',
				'focus_duration',
			];
			for (let i in properties) {
				let property = properties[i];
				if (this.characters_data[property]) {
					console.log('setting override for property ' + property + ', value: ' + this.characters_data[property]);
					this[property] = this.characters_data[property];
				}
			}
			this.smge.resource_manager.load(
				this.characters_data.resources,
				() => {
					super.load();
				}
			);
		});
	}
	compose() {
		console.log('===');
		console.log('composing');
		//TODO set up interface select and highlight sounds since loading is finished
		//TODO this.interface_select_sound = this.smge.resource_manager.resources['interface_select'];
		//TODO this.interface_highlight_sound = this.smge.resource_manager.resources['interface_highlight'];

		// set up sprite fonts
		console.log(' sprite fonts');
		this.smge.g.details_font = new SpriteFont(
			this.smge.resource_manager.resources['details_font_data'],
			this.smge.resource_manager.resources['details_font_spritesheet'],
			true
		);
		this.smge.g.title_font = new SpriteFont(
			this.smge.resource_manager.resources['title_font_data'],
			this.smge.resource_manager.resources['title_font_spritesheet'],
			true
		);

		let interface_spritesheet = this.smge.resource_manager.resources[this.characters_data.interface.resource];
		// set up cursor
		console.log(' cursor');
		this.cursor = new SpringCameraCursor(this.smge);
		// default state
		let cursor_default = Sprite.image_from_spritesheet(
			interface_spritesheet,
			this.characters_data.interface.cursor_default.sx,
			this.characters_data.interface.cursor_default.sy,
			this.characters_data.interface.cursor_default.width,
			this.characters_data.interface.cursor_default.height
		);
		this.cursor.add_state(
			'default',
			cursor_default,
			this.characters_data.interface.cursor_default.origin.x,
			this.characters_data.interface.cursor_default.origin.y
		);
		// pointer state
		let cursor_pointer = Sprite.image_from_spritesheet(
			interface_spritesheet,
			this.characters_data.interface.cursor_pointer.sx,
			this.characters_data.interface.cursor_pointer.sy,
			this.characters_data.interface.cursor_pointer.width,
			this.characters_data.interface.cursor_pointer.height
		);
		this.cursor.add_state(
			'pointer',
			cursor_pointer,
			this.characters_data.interface.cursor_pointer.origin.x,
			this.characters_data.interface.cursor_pointer.origin.y
		);
		this.cursor.change_state('default');
		this.cursor.change_layer(4056);
		this.cursor.anchor.transform.x = 0;
		this.cursor.anchor.transform.y = this.camera_height * -1;
		this.cursor.camera.weight = this.camera_weight;
		// add interface to cursor bounds collide list
		this.cursor.bounds[0].collides.push('interface');
		this.add_module(this.cursor);

		// pip
		console.log(' pip');
		this.pip = new GameObject(this.smge);
		this.pip.add_module(
			new Sprite(
				interface_spritesheet,
				0,
				0,
				this.characters_data.interface.pip.sx,
				this.characters_data.interface.pip.sy,
				this.characters_data.interface.pip.width,
				this.characters_data.interface.pip.height,
			)
		);
		this.pip.sprite.origin.x = this.characters_data.interface.pip.origin.x;
		this.pip.sprite.origin.y = this.characters_data.interface.pip.origin.y;
		this.pip.transform.y = 0;
		this.add_module(this.pip);

		// background
		console.log(' bg');
		this.bg = new Overlay(this.smge, this.background_color);
		this.bg.change_layer(-1);
		this.add_module(this.bg);
		this.checkers = new TiledBackground(
			this.smge,
			this.smge.resource_manager.resources['checkers'],
			//TODO put background direction in data
			0.025,
			-0.025
		);
		this.checkers.change_layer(-2);
		this.add_module(this.checkers);

		// portrait
		console.log(' portrait');
		this.portrait = new GameObject(this.smge);
		this.portrait.change_layer(4);
		this.portrait.add_module(new Sprite());
		this.portrait.add_module(new Bound('portrait', ['cursor'], 0, 0, 1, 1));
		this.portrait.transform.parallax.x = 0;
		this.portrait.transform.parallax.y = 0;
		this.add_module(this.portrait);

		// interface buttons
		console.log(' interface buttons');
		this.buttons = {
			'fullscreen': 'Fullscreen',
			'filter': 'Filter',
			'clear': 'Clear filter',
			'lights': 'Lights',
			'random_solo': 'Random solo',
			'random_pair': 'Random pair',
			'details': 'Unmarked notebook',
			'link': 'Link',
			'alternate': 'Alternates',
		};
		let placement = this.ui_padding;
		for (let name in this.buttons) {
			console.log('  ' + name);
			let display = this.buttons[name];
			this.buttons[name] = new GameObject(this.smge);
			this.buttons[name].display = display;
			this.buttons[name].add_module(
				new Sprite(
					interface_spritesheet,
					this.characters_data.interface[name].width,
					this.characters_data.interface[name].height,
					this.characters_data.interface[name].sx,
					this.characters_data.interface[name].sy,
					this.characters_data.interface[name].width,
					this.characters_data.interface[name].height
				)
			);
			this.buttons[name].name = name;
			// place interface button
			this.buttons[name].transform.x = this.smge.screen.width - placement;
			this.buttons[name].transform.y = this.smge.screen.height - this.ui_padding;
			this.buttons[name].transform.parallax.x = 0;
			this.buttons[name].transform.parallax.y = 0;
			// add bound
			this.buttons[name].add_module(new Bound('interface', ['cursor'], -16, -16, 16, 16));
			this.add_module(this.buttons[name]);
			placement += 16 + 2 + 1;
		}
		// fullscreen
		this.buttons.fullscreen.full = {
			image: this.buttons.fullscreen.sprite.image,
			display: this.buttons.fullscreen.display
		};
		this.buttons.fullscreen.exit = {
			image: Sprite.image_from_spritesheet(
				interface_spritesheet,
				this.characters_data.interface.exit_fullscreen.sx,
				this.characters_data.interface.exit_fullscreen.sy,
				this.characters_data.interface.exit_fullscreen.width,
				this.characters_data.interface.exit_fullscreen.height
			),
			display: 'Exit fullscreen'
		};
		// lights
		this.buttons.lights.on = false;
		// alternate button
		console.log(' alternate button');
		this.buttons.alternate.sprite.origin.x = 7;
		this.buttons.alternate.sprite.origin.y = 0;
		this.buttons.alternate.bounds[0].offset.x = -8;
		this.buttons.alternate.bounds[0].offset.y = 0;
		this.buttons.alternate.transform.parallax.x = 1;
		this.buttons.alternate.transform.parallax.y = 1;
		this.buttons.alternate.transform.y = this.alternate_button_offset;
		// dim/original versions
		let toggles = ['lights', 'details', 'link'];
		for (let i in toggles) {
			let toggle = toggles[i];
			this.buttons[toggle].original = this.buttons[toggle].sprite.image;
			this.buttons[toggle].dim = document.createElement('canvas');
			this.buttons[toggle].dim.width = this.buttons[toggle].original.width;
			this.buttons[toggle].dim.height = this.buttons[toggle].original.height;
			let dim_ctx = this.buttons[toggle].dim.getContext('2d');
			dim_ctx.drawImage(
				this.buttons[toggle].original,
				0,
				0,
				this.buttons[toggle].dim.width,
				this.buttons[toggle].dim.height,
				0,
				0,
				this.buttons[toggle].dim.width,
				this.buttons[toggle].dim.height
			);
			dim_ctx.globalCompositeOperation = 'source-atop';
			dim_ctx.fillStyle = '#00000080';
			dim_ctx.fillRect(0, 0, this.buttons[toggle].dim.width, this.buttons[toggle].dim.height);
		}
		// interface tip
		console.log(' interface tip');
		this.interface_tip = new Text(
			this.smge,
			this.smge.g.details_font,
			'right',
			'bottom',
			'left',
			'#ffffff',
			'none',
			0,
			0,
			'interface tip'
		);
		this.interface_tip.name = 'interface tip';
		this.interface_tip.transform.x = this.smge.screen.width - this.ui_padding;
		this.interface_tip.transform.y = this.smge.screen.height - (this.ui_padding * 2) - 16;
		this.interface_tip.transform.parallax.x = 0;
		this.interface_tip.transform.parallax.y = 0;
		this.add_module(this.interface_tip);
		this.interface_tip.disable();

		// name
		console.log(' name');
		this.character_name = new GameObject(this.smge);
		let name_text = new Text(
			this.smge,
			this.smge.g.title_font,
			'right',
			'top',
			'left',
			this.text_color,
			'none',
			0,
			0,
			'character name'
		);
		name_text.name = 'character name';
		name_text.change_layer(3);
		name_text.transform.x = this.smge.screen.width - this.ui_padding - this.name_padding;
		name_text.transform.y = this.ui_padding + this.name_padding;
		name_text.transform.parallax.x = 0;
		name_text.transform.parallax.y = 0;
		// name background
		console.log('  bg');
		let name_background = new Rect(
			this.smge,
			this.characters_data.overlay_color,
			1,
			this.smge.g.title_font.height + (this.name_padding * 2),
			'right',
			'top'
		);
		name_background.name = 'character name background';
		name_background.change_layer(2);
		name_background.transform.x = this.smge.screen.width - this.ui_padding;
		name_background.transform.y = this.ui_padding;
		name_background.transform.parallax.x = 0;
		name_background.transform.parallax.y = 0;

		this.character_name.background = name_background;
		this.character_name.text = name_text;
		this.character_name.add_module(name_background);
		this.character_name.add_module(name_text);
		this.add_module(this.character_name);

		// details
		console.log(' details');
		this.character_details = new GameObject(this.smge);
		let details_text = new Text(
			this.smge,
			this.smge.g.details_font,
			'left',
			'top',
			'left',
			this.text_color,
			'none',
			0,
			0,
			'character details'
		);
		details_text.name = 'character details';
		details_text.change_layer(3);
		details_text.transform.x = this.ui_padding + this.details_padding;
		details_text.transform.y = this.ui_padding + this.character_name.text.height + (this.name_padding * 2) + this.details_padding;
		details_text.transform.parallax.x = 0;
		details_text.transform.parallax.y = 0;
		// details background
		console.log('  bg');
		let details_background = new Rect(
			this.smge,
			this.characters_data.overlay_color,
			this.smge.screen.width - this.ui_padding,
			this.smge.screen.height - (this.ui_padding * 4) - this.character_name.text.height - (this.name_padding * 2) - this.interface_tip.height - 16,
			'right',
			'top'
		);
		details_background.name = 'character details background';
		details_background.change_layer(1);
		details_background.transform.x = this.smge.screen.width - this.ui_padding;
		details_background.transform.y = this.ui_padding + this.character_name.text.height + (this.name_padding * 2);
		details_background.transform.parallax.x = 0;
		details_background.transform.parallax.y = 0;

		this.character_details.background = details_background;
		this.character_details.text = details_text;
		this.character_details.add_module(details_background);
		this.character_details.add_module(details_text);
		this.add_module(this.character_details);
		this.character_details.disable();

		// characters
		console.log(' generating character objects from characters data');
		console.log(this.characters_data);
		for (let id in this.characters_data.characters) {
			console.log('  ' + id);
			console.log('   data:');
			let data = this.characters_data.characters[id];
			console.log(data);
			let character = new GameObject(this.smge);
			character.add_module(new Transform());
			character.id = id;
			character.current_alternate = '';
			character.alternates = {};
			console.log('   alternates:');
			for (let j in data) {
				let alternate_data = data[j];
				if (alternate_data.hidden) {
					continue;
				}
				console.log('    ' + alternate_data.id);
				console.log('     base:');
				console.log(alternate_data.base);
				let alternate = {};
				alternate.id = alternate_data.id;
				alternate.name = alternate_data.name;
				alternate.link = alternate_data.link;
				alternate.background_color = alternate_data.background_color;
				alternate.text_color = alternate_data.text_color;
				alternate.overlay_color = alternate_data.overlay_color;
				alternate.details = ''
				if (alternate_data.details) {
					alternate.details = alternate_data.details;
				}
				alternate.creators = alternate_data.creators;
				alternate.settings = alternate_data.settings;
				// portrait sprite image
				alternate.portrait = Sprite.image_from_spritesheet(
					this.smge.resource_manager.resources[alternate_data.portrait.resource],
					alternate_data.portrait.sx,
					alternate_data.portrait.sy,
					alternate_data.portrait.width,
					alternate_data.portrait.height
				);
				// base static sprite
				alternate.base = new GameObject(this.smge);
				alternate.base.add_module(
					new Sprite(
						this.smge.resource_manager.resources[alternate_data.base.resource],
						alternate_data.base.origin.x,
						alternate_data.base.origin.y,
						alternate_data.base.sx,
						alternate_data.base.sy,
						alternate_data.base.width,
						alternate_data.base.height
					)
				);
				// dim base
				console.log('     generating dim static base');
				alternate.base.original = alternate.base.sprite.image;
				alternate.base.dim = document.createElement('canvas');
				alternate.base.dim.width = alternate.base.original.width;
				alternate.base.dim.height = alternate.base.original.height;
				let dim_ctx = alternate.base.dim.getContext('2d');
				dim_ctx.drawImage(
					alternate.base.original,
					0,
					0,
					alternate.base.dim.width,
					alternate.base.dim.height,
					0,
					0,
					alternate.base.dim.width,
					alternate.base.dim.height
				);
				dim_ctx.globalCompositeOperation = 'source-atop';
				dim_ctx.fillStyle = '#ffffff40';
				dim_ctx.fillRect(0, 0, alternate.base.dim.width, alternate.base.dim.height);
				dim_ctx.fillStyle = '#000000d0';
				dim_ctx.fillRect(0, 0, alternate.base.dim.width, alternate.base.dim.height);
				alternate.base.sprite.set_image(alternate.base.dim);
				// attach base sprite to character transform
				alternate.base.add_module(new Attach(character.transform));
				//TODO animations and idles/dim animations and idles
				// add alternate base as module
				character.add_module(alternate.base);
				alternate.base.disable();
				if (!character.current_alternate) {
					character.current_alternate = alternate.id;
				}
				character.alternates[alternate.id] = alternate;
			}
			// add bound for click-to-focus
			console.log('     bound for click-to-focus');
			character.add_module(new Bound('interface', ['cursor'], 0, 0, 1, 1));
			this.set_character_bound(character);
			// add character as module, disable, and add to character dict
			this.add_module(character);
			character.disable();
			this.characters[id] = character;
		}

		// get initial filters from querystring
		console.log('  initial filters');
		this.filter = {
			creators: [],
			settings: [],
		};
		let lights = this.url_params.get('lights');
		if (null != lights) {
			this.buttons.lights.on = true;
		}
		let creators = this.url_params.get('creators');
		if (creators) {
			this.filter.creators = creators.split(',');
		}
		let settings = this.url_params.get('settings');
		if (settings) {
			this.filter.settings = settings.split(',');
		}
		this.apply_filter();
		this.place_filtered_characters();
		this.refocus();

		let characters = this.url_params.get('characters');
		if (characters) {
			// subselect specific characters
			this.subselect(characters.split(','));
		}

		// filter menu
		console.log(' filter menu');
		this.filter_menu = new GameObject(this.smge);
		let filter_bg = new Rect(
			this.smge,
			'#00000080',
			this.smge.screen.width - (this.ui_padding * 2),
			this.smge.screen.height - (this.ui_padding * 4) - 16 - this.smge.g.details_font.height,
			'left',
			'top'
		);
		filter_bg.transform.parallax.x = 0;
		filter_bg.transform.parallax.y = 0;
		filter_bg.transform.x = this.ui_padding;
		filter_bg.transform.y = this.ui_padding;
		this.filter_menu.add_module(filter_bg);

		// filter tip
		console.log(' filter tip');
		this.filter_menu.tip_text = new Text(
			this.smge,
			this.smge.g.title_font,
			'left',
			'bottom',
			'left',
			'#ffffff',
			'none',
			0,
			0,
			' '
		);
		this.filter_menu.tip_text.name = 'filter_tip';
		this.filter_menu.tip_text.change_layer(3);
		this.filter_menu.tip_text.transform.x = this.ui_padding - this.name_padding;
		this.filter_menu.tip_text.transform.y = this.smge.screen.height - this.ui_padding - this.name_padding;
		this.filter_menu.tip_text.transform.parallax.x = 0;
		this.filter_menu.tip_text.transform.parallax.y = 0;
		// filter tip background
		console.log('  bg');
		this.filter_menu.tip_background = new Rect(
			this.smge,
			this.characters_data.overlay_color,
			1,
			(this.ui_padding * 2) + 16 + (this.name_padding * 2) + this.smge.g.details_font.height - 2, // why is it two off?
			'left',
			'bottom'
		);
		this.filter_menu.tip_background.name = 'filter tip background';
		this.filter_menu.tip_background.change_layer(2);
		this.filter_menu.tip_background.transform.x = this.ui_padding;
		this.filter_menu.tip_background.transform.y = this.smge.screen.height - this.ui_padding;
		this.filter_menu.tip_background.transform.parallax.x = 0;
		this.filter_menu.tip_background.transform.parallax.y = 0;

		this.filter_menu.add_module(this.filter_menu.tip_background);
		this.filter_menu.add_module(this.filter_menu.tip_text);

		// filter creators
		let position_y = (this.ui_padding * 2);
		let filter_creators_text = new Text(
			this.smge,
			this.smge.g.details_font,
			'left',
			'top',
			'left',
			'#ffffff',
			'none',
			0,
			0,
			'Creators'
		);
		filter_creators_text.name = 'filter creators';
		filter_creators_text.transform.parallax.x = 0;
		filter_creators_text.transform.parallax.y = 0;
		filter_creators_text.transform.x = (this.ui_padding * 2);
		filter_creators_text.transform.y = (this.ui_padding * 2);
		this.filter_menu.add_module(filter_creators_text);
		// creator sprites and bounds
		let position_x = this.ui_padding * 2;
		position_y += this.ui_padding + this.smge.g.details_font.height;
		console.log(' generating creator tiles from data');
		let creators_spritesheet = this.smge.resource_manager.resources[this.characters_data.creators.resource];
		this.filter_menu.creators = [];
		for (let i in this.characters_data.creators.items) {
			let data = this.characters_data.creators.items[i];
			let creator = new GameObject(this.smge);
			console.log('  ' + data.id);
			creator.add_module(new Sprite());
			creator.add_module(new Shaker());
			creator.id = data.id;
			creator.name = data.name;
			console.log('cutting creator image from spritesheet:');
			console.log(creators_spritesheet);
			console.log(data.sprite.sx + ',' + data.sprite.sy + ' ' + data.sprite.width + 'x' + data.sprite.height);
			creator.original = Sprite.image_from_spritesheet(
				creators_spritesheet,
				data.sprite.sx,
				data.sprite.sy,
				data.sprite.width,
				data.sprite.height
			);
			// mid tile
			creator.mid = document.createElement('canvas');
			creator.mid.width = creator.original.width;
			creator.mid.height = creator.original.height;
			let mid_ctx = creator.mid.getContext('2d');
			mid_ctx.drawImage(
				creator.original,
				0,
				0,
				creator.mid.width,
				creator.mid.height,
				0,
				0,
				creator.mid.width,
				creator.mid.height
			);
			mid_ctx.globalCompositeOperation = 'source-atop';
			mid_ctx.fillStyle = '#00000080';
			mid_ctx.fillRect(0, 0, creator.mid.width, creator.mid.height);
			// dim tile
			creator.dim = document.createElement('canvas');
			creator.dim.width = creator.original.width;
			creator.dim.height = creator.original.height;
			let dim_ctx = creator.dim.getContext('2d');
			dim_ctx.drawImage(
				creator.original,
				0,
				0,
				creator.dim.width,
				creator.dim.height,
				0,
				0,
				creator.dim.width,
				creator.dim.height
			);
			dim_ctx.globalCompositeOperation = 'source-atop';
			dim_ctx.fillStyle = '#000000d0';
			dim_ctx.fillRect(0, 0, creator.dim.width, creator.dim.height);
			creator.sprite.set_image(creator.dim);
			// move to position
			creator.transform.parallax.x = 0;
			creator.transform.parallax.y = 0;
			creator.transform.y = position_y;
			creator.transform.x = position_x;
			// wrap
			if (creator.transform.x + creator.sprite.width > (this.smge.screen.width - (this.ui_padding * 2))) {
				position_x = this.ui_padding * 2;
				position_y += setting.sprite.height + 2;
				creator.transform.x = position_x;
				creator.transform.y = position_y;
			}
			// add bound for toggle creator filter
			console.log('     bound for toggle creator filter');
			creator.add_module(new Bound('interface', ['cursor'], 0, 0, creator.original.width, creator.original.height));
			// add creator as module, and add to creators array
			this.filter_menu.add_module(creator);
			this.filter_menu.creators.push(creator);
			position_x += creator.original.width + 2 + 1;
		}
		position_y += this.filter_menu.creators[0].original.height + this.ui_padding;
		// filter settings
		let filter_settings_text = new Text(
			this.smge,
			this.smge.g.details_font,
			'left',
			'top',
			'left',
			'#ffffff',
			'none',
			0,
			0,
			'Settings'
		);
		filter_settings_text.name = 'filter settings';
		filter_settings_text.transform.parallax.x = 0;
		filter_settings_text.transform.parallax.y = 0;
		filter_settings_text.transform.x = (this.ui_padding * 2);
		filter_settings_text.transform.y = position_y;
		this.filter_menu.add_module(filter_settings_text);
		// settings sprites and bounds
		position_x = this.ui_padding * 2;
		position_y +=  this.smge.g.details_font.height + this.ui_padding;
		console.log(' generating setting tiles from data');
		let settings_spritesheet = this.smge.resource_manager.resources[this.characters_data.settings.resource];
		this.filter_menu.settings = [];
		for (let i in this.characters_data.settings.items) {
			let data = this.characters_data.settings.items[i];
			let setting = new GameObject(this.smge);
			console.log('  ' + data.id);
			setting.add_module(new Sprite());
			setting.add_module(new Shaker());
			setting.id = data.id;
			setting.name = data.name;
			console.log('cutting setting image from spritesheet:');
			console.log(settings_spritesheet);
			console.log(data.sprite.sx + ',' + data.sprite.sy + ' ' + data.sprite.width + 'x' + data.sprite.height);
			setting.original = Sprite.image_from_spritesheet(
				settings_spritesheet,
				data.sprite.sx,
				data.sprite.sy,
				data.sprite.width,
				data.sprite.height
			);
			// mid
			setting.mid = document.createElement('canvas');
			setting.mid.width = setting.original.width;
			setting.mid.height = setting.original.height;
			let mid_ctx = setting.mid.getContext('2d');
			mid_ctx.drawImage(
				setting.original,
				0,
				0,
				setting.mid.width,
				setting.mid.height,
				0,
				0,
				setting.mid.width,
				setting.mid.height
			);
			mid_ctx.globalCompositeOperation = 'source-atop';
			mid_ctx.fillStyle = '#00000080';
			mid_ctx.fillRect(0, 0, setting.mid.width, setting.mid.height);
			// dim
			setting.dim = document.createElement('canvas');
			setting.dim.width = setting.original.width;
			setting.dim.height = setting.original.height;
			let dim_ctx = setting.dim.getContext('2d');
			dim_ctx.drawImage(
				setting.original,
				0,
				0,
				setting.dim.width,
				setting.dim.height,
				0,
				0,
				setting.dim.width,
				setting.dim.height
			);
			dim_ctx.globalCompositeOperation = 'source-atop';
			dim_ctx.fillStyle = '#000000d0';
			dim_ctx.fillRect(0, 0, setting.dim.width, setting.dim.height);
			setting.sprite.set_image(setting.dim);
			// move to position
			setting.transform.parallax.x = 0;
			setting.transform.parallax.y = 0;
			setting.transform.y = position_y;
			setting.transform.x = position_x;
			// wrap
			if (setting.transform.x + setting.sprite.width > (this.smge.screen.width - (this.ui_padding * 2))) {
				position_x = this.ui_padding * 2;
				position_y += setting.sprite.height + 2;
				setting.transform.x = position_x;
				setting.transform.y = position_y;
			}
			// add bound for toggle setting filter
			console.log('     bound for toggle setting filter');
			setting.add_module(new Bound('interface', ['cursor'], 0, 0, setting.original.width, setting.original.height));
			// add setting as module, and add to creators array
			this.filter_menu.add_module(setting);
			this.filter_menu.settings.push(setting);
			position_x += setting.original.width + 2 + 1;
		}

		this.filter_menu.change_layer(5);
		this.add_module(this.filter_menu);
		this.filter_menu.disable();

		super.compose();
	}
	set_character_bound(character) {
		console.log('setting character bound for ' + character.id);
		let current_alternate = character.alternates[character.current_alternate];
		character.bounds[0].offset.x = -1 * current_alternate.base.sprite.origin.x;
		character.bounds[0].offset.y = -1 * current_alternate.base.sprite.origin.y;
		character.bounds[0].width = current_alternate.base.sprite.width;
		character.bounds[0].height = current_alternate.base.sprite.height;
		character.bounds[0].refresh();
	}
	apply_filter() {
		console.log('===');
		console.log('applying filter');
		// clear filtered characters
		this.filtered_characters = [];
		for (let character_id in this.characters) {
			console.log(' ' + character_id);
			let character = this.characters[character_id];
			let last_alternate = character.current_alternate;
			// determine if any alternates of the current character should be filtered out
			for (let alternate_id in character.alternates) {
				let alternate = character.alternates[alternate_id];
				alternate.filtered = false;
				// disable alternate base
				character.alternates[alternate_id].base.disable();
				//TODO disable alternate animations
				// filters were specified
				if (this.filter) {
					if (this.filter.creators && this.filter.creators.length) {
						let matched = false;
						for (let i in this.filter.creators) {
							// alternate is by one of the specified creators
							if (-1 != alternate.creators.indexOf(this.filter.creators[i])) {
								matched = true;
								break;
							}
						}
						if (!matched) {
							console.log('  filtering out because no creators matched');
							alternate.filtered = true;
							continue;
						}
					}
					if (this.filter.settings && this.filter.settings.length) {
						let matched = false;
						for (let i in this.filter.settings) {
							// alternate is part of one of the specified settings
							if (-1 != alternate.settings.indexOf(this.filter.settings[i])) {
								matched = true;
								break;
							}
						}
						if (!matched) {
							console.log('  filtering out because no settings matched');
							alternate.filtered = true;
							continue;
						}
					}
				}
			}
			// previously current alternate was not set or is now filtered
			if (!last_alternate || character.alternates[last_alternate].filtered) {
				console.log(' no last alternate or "' + last_alternate + '" is now filtered out');
				character.current_alternate = '';
				// set first non-filtered alternate to new current
				for (let alternate_id in character.alternates) {
					if (!character.alternates[alternate_id].filtered) {
						character.current_alternate = alternate_id;
						break;
					}
				}
				// no enabled alternates, disable and skip this character
				if (!character.current_alternate) {
					console.log(' no enabled alternates, disabling and skipping this character');
					character.disable();
					continue;
				}
			}
			let current_alternate = character.alternates[character.current_alternate];
			// enable current alternate base
			current_alternate.base.enable();
			//TODO enable current alternate animations
			//TODO use idles/animations instead of base which will need the main character object to know the max width/offset of all animations for this alternate
			console.log('  enabling base');
			let current_base = current_alternate.base;
			current_base.enable();
			// enable and push to characters array
			console.log('  enabling character');
			character.enable();
			console.log('  adding character to filtered characters');
			this.filtered_characters.push(character);
		}
		this.set_querystring();
	}
	place_filtered_characters() {
		console.log('===');
		console.log('placing filtered characters');
		let x = 0;
		for (let i in this.filtered_characters) {
			let character = this.filtered_characters[i];
			console.log(' ' + character.id);
			if (
				!character.current_alternate
				|| !character.alternates[character.current_alternate]
				|| !character.alternates[character.current_alternate].base
				|| character.alternates[character.current_alternate].base.disabled
			) {
				console.log('  current alternate "' + character.current_alternate + '" didn\'t exist or was disabled');
				continue;
			}
			console.log('  placing current alternate "' + character.current_alternate + '"');
			let current_base = character.alternates[character.current_alternate].base;
			// set transform x for character
			x += this.spacing + current_base.sprite.origin.x;
			character.transform.x = x;
			x += current_base.sprite.width - current_base.sprite.origin.x;
		}
	}
	refocus(duration) {
		console.log('===');
		console.log('refocusing on ' + this.focused);
		// if previously focused character is no longer enabled then focus the first character
		console.log('filtered characters:');
		console.log(this.filtered_characters);
		if (
			!this.focused
			|| (
				!this.characters[this.focused]
				|| !this.characters[this.focused].alternates
				|| !this.characters[this.focused].alternates[this.characters[this.focused].current_alternate]
				|| !this.characters[this.focused].alternates[this.characters[this.focused].current_alternate].base
				|| this.characters[this.focused].alternates[this.characters[this.focused].current_alternate].base.disabled
			)
		) {
			console.log('previously focused character not set, or invalid, or now disabled, setting to: ' + this.filtered_characters[0].id);
			this.focused = this.filtered_characters[0].id;
		}
		//TODO set currently focused index for keyboard navigation
		// instant focus
		console.log('instant focusing character: ' + this.focused);
		this.focus_character(this.characters[this.focused], duration);
	}
	set_all_sprites() {
		console.log('===');
		console.log('setting all sprites for filtered characters');
		// non-selected characters
		for (let i in this.filtered_characters) {
			let character = this.filtered_characters[i];
			// disable all alternate bases
			for (let id in character.alternates) {
				character.alternates[id].base.disable();
			}
			let current_alternate = character.alternates[character.current_alternate];
			current_alternate.base.enable();
			console.log(' setting character ' + character.id + ' to alternate ' + character.current_alternate);
			//TODO disable base animation
			//TODO remove timers for secondary idle animations
			if (!this.buttons.lights.on) {
				// set to base dim sprite
				current_alternate.base.sprite.set_image(current_alternate.base.dim);
			}
			else {
				// set to base original sprite
				current_alternate.base.sprite.set_image(current_alternate.base.original);
			}
			// change to non-selected scale
			current_alternate.base.transform.scale.x = 1;
			current_alternate.base.transform.scale.y = 1;
			current_alternate.base.transform.y = 0;
			this.set_character_bound(character);
			//TODO disable portrait?
		}
		//let character = this.filtered_characters[this.current_index];
		let character = this.characters[this.focused];
		let current_alternate = character.alternates[character.current_alternate];
		console.log(' un-dimming current character ' + character.id + ' alternate ' + character.current_alternate);
		if (!this.buttons.lights.on) {
			// un-dim selected character
			current_alternate.base.sprite.set_image(current_alternate.base.original);
		}
		// change to selected scale
		current_alternate.base.transform.y = this.selected_y_offset;
		current_alternate.base.transform.scale.x = this.selected_scale;
		current_alternate.base.transform.scale.y = this.selected_scale;
	}
	toggle_lights() {
		this.buttons.lights.on = !this.buttons.lights.on;
		this.set_all_sprites();
	}
	toggle_fullscreen() {
		console.log('toggling fullscreen');
		if (window.fullScreen || window.innerHeight == screen.height) {
			console.log('currently fullscreen, exiting fullscreen');
			document.exitFullscreen();
		}
		else {
			console.log('currently not fullscreen, entering fullscreen');
			this.smge.screen.display.canvas.requestFullScreen();
		}
	}
	set_fullscreen_interface() {
		if (window.fullScreen || window.innerHeight == screen.height) {
			this.buttons.fullscreen.sprite.set_image(this.buttons.fullscreen.exit.image);
			this.buttons.fullscreen.display = this.buttons.fullscreen.exit.display;
		}
		else {
			this.buttons.fullscreen.sprite.set_image(this.buttons.fullscreen.full.image);
			this.buttons.fullscreen.display = this.buttons.fullscreen.full.display;
		}
	}
	focus_character(character, duration) {
		console.log('===');
		console.log('focusing character ' + character.id + ' over ' + duration);
		this.focused = character.id;
		this.current_index = this.filtered_characters.indexOf(character);
		let current_alternate = character.alternates[character.current_alternate];
		this.set_all_sprites();
		// move pip above character
		//TODO when animations are added use overall height for sprite y offset
		let pip_offset = this.pip_offset + this.pip.sprite.height;
		// sprite offset is less than sprite height (non-floating character)
		if (current_alternate.base.sprite.height > current_alternate.base.sprite.origin.y) {
			pip_offset += current_alternate.base.sprite.height;
		}
		else {
			pip_offset += current_alternate.base.sprite.origin.y;
		}
		this.pip.transform.x = character.transform.x;
		this.pip.sprite.origin.y = pip_offset;
		if (!duration) {
			duration = 0;
		}
		// character overlay color
		let overlay_color = this.characters_data.overlay_color;
		if (current_alternate.overlay_color) {
			overlay_color = current_alternate.overlay_color;
		}
		this.character_name.background.color = overlay_color;
		this.character_details.background.color = overlay_color;
		// character text color
		let color = this.text_color;
		if (current_alternate.text_color) {
			color = current_alternate.text_color;
		}
		this.character_name.text.color = color;
		this.character_details.text.color = color;
		// set character name
		this.character_name.text.set_text(this.characters_data.name_prefix + current_alternate.name);
		// name overlay width
		this.character_name.background.width = this.character_name.text.width + this.name_padding * 2;
		// background color and effects
		let background_color = this.background_color;
		if (current_alternate.background_color) {
			background_color = current_alternate.background_color;
		}
		this.bg.color = background_color;
		//TODO switch to base idle animation
		//TODO set up timers for secondary idle animations
		// portrait change
		if (this.portrait.sprite.image != current_alternate.portrait) {
			// change portrait image
			this.portrait.sprite.set_image(current_alternate.portrait);
			// update bound
			//TODO bound should be specifiable in the character data
			//TODO in case the actual area used in the portrait sprite is small
			this.portrait.bounds[0].width = this.portrait.sprite.image.width;
			this.portrait.bounds[0].height = this.portrait.sprite.image.height;
			// move portrait offscreen
			this.portrait.transform.x = -1 * this.portrait.sprite.image.width;
			// slide in portrait over duration
			this.portrait.transform.move_to(0, 0, this.focus_duration);
		}
		// details text wrap width
		this.details_width = this.smge.screen.width - (this.ui_padding * 2) - this.portrait.sprite.width;
		this.character_details.text.transform.x = this.portrait.sprite.width + this.details_padding;
		if (!current_alternate.details) {
			this.character_details.text.text = '';
		}
		else {
			this.character_details.text.set_text(
				Text.wrap(
					this.characters_data.details_prefix + current_alternate.details,
					this.smge.g.details_font,
					this.details_width - (this.details_padding * 2)
				)
			);
		}
		this.show_details();
		// link button
		if (current_alternate.link) {
			this.buttons.link.target = current_alternate.link;
			this.buttons.link.sprite.set_image(this.buttons.link.original);
		}
		else {
			this.buttons.link.target = '';
			this.buttons.link.sprite.set_image(this.buttons.link.dim);
		}
		// alternates button
		let available_alternate_count = 0;
		for (let alternate_id in character.alternates) {
			if (!character.alternates[alternate_id].filtered) {
				available_alternate_count += 1;
			}
		}
		if (1 < available_alternate_count) {
			this.buttons.alternate.transform.x = character.transform.x;
			this.buttons.alternate.enable();
		}
		else {
			this.buttons.alternate.disable();
		}
		// move camera anchor to center character in non-portrait portion of screen
		let half_screen_width = this.smge.screen.width / 2;
		let portrait_to_origin_width = half_screen_width - this.portrait.sprite.width;
		let non_portrait_width = this.smge.screen.width - this.portrait.sprite.width;
		let half_non_portrait_width = non_portrait_width / 2;
		this.cursor.anchor.transform.move_to(
			character.transform.x - (half_non_portrait_width - portrait_to_origin_width),
			this.cursor.anchor.transform.y,
			duration
		);
	}
	subselect(alternate_ids) {
		this.filtered_characters = [];
		for (let character_id in this.characters) {
			let character = this.characters[character_id];
			character.disable();
			for (let alternate_id in character.alternates) {
				if (-1 != alternate_ids.indexOf(alternate_id)) {
					character.current_alternate = alternate_id;
					character.enable();
					character.alternates[alternate_id].base.enable();
					this.filtered_characters.push(character);
				}
			}
		}
		// set focused and current index to first in filtered
		this.focused = this.filtered_characters[0].id;
		this.current_index = 0;
		this.place_filtered_characters();
		this.refocus();
		//TODO set combo description if available
	}
	choose_random(total) {
		console.log('===');
		console.log('choosing random');
		console.log(' re-apply current filter');
		this.apply_filter();
		// disable all
		console.log(' disabling all');
		for (let i in this.characters) {
			this.characters[i].disable();
		}
		// choose randomly from filtered characters
		let chosen_alternate_ids = [];
		let pool = this.filtered_characters.slice();
		while (0 < total && 0 < pool.length) {
			let rand_index = Math.floor(Math.random() * pool.length);
			let character = pool[rand_index];
			pool.splice(rand_index, 1);
			// get non-filtered alternates of this character
			let alternate_pool = [];
			for (let alternate_id in character.alternates) {
				if (!character.alternates[alternate_id].filtered) {
					alternate_pool.push(alternate_id);
				}
			}
			// multiple alternates
			if (1 < alternate_pool.length) {
				// choose randomly from non-filtered alternates
				let rand_alternate_index = Math.floor(Math.random() * alternate_pool.length);
				character.current_alternate = alternate_pool[rand_alternate_index];
			}
			chosen_alternate_ids.push(character.current_alternate);
			total -= 1;
		}
		// lights always on for random
		this.buttons.lights.on = true;
		this.subselect(chosen_alternate_ids);
		// add chosen characters to querystring
		let querystring = chosen_alternate_ids.join(',');
		this.url_params.set('characters', querystring);
		this.set_querystring();
	}
	set_querystring() {
		if (this.buttons.lights.on) {
			// ensure lights is part of querystring
			this.url_params.set('lights', '');
		}
		else {
			// ensure lights is not part of querystring
			this.url_params.delete('lights');
		}
		let url_params_string = this.url_params.toString();
		// remove trailing = from querystring
		if (url_params_string && '=' == url_params_string[url_params_string.length - 1]) {
			url_params_string = url_params_string.substring(0, url_params_string.length - 1);
		}
		if (url_params_string) {
			// remove =& from querystring
			url_params_string = '?' + url_params_string.replace('=&', '&');
		}
		history.replaceState(null, '', window.location.pathname + url_params_string);
	}
	update() {
		super.update();
		if (this.buttons && this.buttons.fullscreen) {
			this.set_fullscreen_interface();
		}
		if (!this.pip) {
			return;
		}
		if (this.pip.transform.y > this.pip_maximum_swing) {
			this.pip_direction = -1;
		}
		else if (this.pip.transform.y < (-1 * this.pip_maximum_swing)) {
			this.pip_direction = 1;
		}
		this.pip.transform.y += (this.pip_direction * this.pip_impulse);
	}
	next_alternate(character) {
		let alternate_ids = Object.keys(character.alternates);
		let alternate_index = alternate_ids.indexOf(character.current_alternate);
		alternate_index += 1;
		if (alternate_index > alternate_ids.length - 1) {
			alternate_index = 0;
		}
		while (character.alternates[alternate_ids[alternate_index]].filtered) {
			alternate_index += 1;
			if (alternate_index > alternate_ids.length - 1) {
				alternate_index = 0;
			}
		}
		character.current_alternate = alternate_ids[alternate_index];
		this.set_all_sprites();
		this.place_filtered_characters();
		this.refocus();
		this.set_querystring();
	}
	previous_alternate(character) {
		let alternate_ids = Object.keys(character.alternates);
		let alternate_index = alternate_ids.indexOf(character.current_alternate);
		alternate_index -= 1;
		if (0 > alternate_index) {
			alternate_index = alternate_ids.length - 1;
		}
		while (character.alternates[alternate_ids[alternate_index]].filtered) {
			alternate_index -= 1;
			if (0 > alternate_index) {
				alternate_index = alternate_ids.length - 1;
			}
		}
		character.current_alternate = alternate_ids[alternate_index];
		this.set_all_sprites();
		this.place_filtered_characters();
		this.refocus();
		this.set_querystring();
	}
	clear() {
		// remove specified characters from querystring
		// since they aren't intrinsic to a user-specified filter
		this.url_params.delete('characters');
		// lights off when clearing filter
		this.buttons.lights.on = false;
		this.filter = {};
		this.apply_filter();
		this.place_filtered_characters();
		this.refocus();
	}
	filter_item_check(type) {
		let filter = [];
		let filter_menu = [];
		if ('creator' == type) {
			filter = this.filter.creators;
			filter_menu = this.filter_menu.creators;
		}
		else {
			filter = this.filter.settings;
			filter_menu = this.filter_menu.settings;
		}
		for (let i in filter_menu) {
			let item = filter_menu[i];
			let index = -1;
			if (filter) {
				index = filter.indexOf(item.id);
			}
			else {
				filter = [];
			}
			if (this.smge.bound_manager.check(item.bounds[0], 'during', '')) {
				this.cursor.change_state('pointer');
				let highlight = 'mid';
				// click toggles filter
				if (this.smge.input.released('m1')) {
					console.log(' click on filter button ' + item.id);
					if (-1 == index) {
						filter.push(item.id);
						highlight = 'original';
					}
					else if (1 == filter.length) {
						item.shaker.shake(5, 250);
						highlight = 'original';
					}
					else {
						filter.splice(index, 1);
						highlight = 'mid';
					}
				}
				else if (-1 != index) {
					highlight = 'original';
				}
				item.sprite.set_image(item[highlight]);
				this.filter_menu.tip_text.enable();
				this.filter_menu.tip_background.enable();
				let new_text = this.characters_data.name_prefix + item.name;
				if (this.filter_menu.tip_text.text == new_text) {
					return;
				}
				this.filter_menu.tip_text.set_text(new_text);
				this.filter_menu.tip_background.width = this.filter_menu.tip_text.width + (this.name_padding * 2);
			}
			else if (filter && -1 != index) {
				item.sprite.set_image(item.original);
			}
			else {
				item.sprite.set_image(item.dim);
			}
		}
	}
	interface_input_update() {
		// f for filter
		if (this.smge.input.pressed('f')) {
			this.toggle_filter_menu();
		}

		//TODO fullscreen other than f11?

		// disable interface tip unless filter is up
		if (this.filter_menu.disabled) {
			this.interface_tip.disable();
		}
		// over interface buttons
		for (let name in this.buttons) {
			if (
				!this.smge.bound_manager.check(
					this.buttons[name].bounds[0],
					'during',
					'cursor'
				)
			) {
				continue;
			}
			// skip dimmed buttons
			if (
				this.buttons[name].dim
				&& this.buttons[name].sprite.image == this.buttons[name].dim
			) {
				continue;
			}
			this.interface_tip.enable();
			this.interface_tip.set_text(this.buttons[name].display);
			this.cursor.change_state('pointer');
			// interface click
			if (this.smge.input.released('m1')) {
				switch (name) {
					case 'alternate':
						console.log('alternate button');
						let character = this.filtered_characters[this.current_index];
						this.next_alternate(character);
						break;
					case 'link':
						console.log('link button');
						window.open(this.buttons.link.target,'_blank');
						break;
					case 'details':
						console.log('details button');
						this.character_details.toggle_disabled();
						break;
					case 'random_pair':
						console.log('random pair button');
						this.choose_random(2);
						break;
					case 'random_solo':
						console.log('random solo button');
						this.choose_random(1);
						break;
					case 'lights':
						console.log('lights button');
						this.toggle_lights();
						this.set_querystring();
						break;
					case 'clear':
						console.log('clear button');
						this.clear();
						break;
					case 'filter':
						console.log('filter button');
						this.toggle_filter_menu();
						break;
					case 'fullscreen':
						console.log('fullscreen button');
						this.toggle_fullscreen();
						break;
				}
			}
		}
	}
	filter_input_update() {
		if (!this.filter) {
			return;
		}
		this.filter_menu.tip_text.disable();
		this.filter_menu.tip_background.disable();
		this.filter_item_check('creator');
		this.filter_item_check('setting');

		//TODO keyboard controls for filter?
		//TODO up/down to switch between creators and settings blocks
		//TODO left/right for navigation between items in the current block
		//TODO spacebar for toggle currently highlighted item

		// escape for leave filter
		if (this.smge.input.pressed('Escape')) {
			this.close_filter_menu();
		}
	}
	character_input_update() {
		// home/end for first last
		if (this.smge.input.pressed('Home')) {
			console.log('home in characters');
			this.current_index = 0;
			this.focus_character(this.filtered_characters[this.current_index], this.focus_duration);
		}
		if (this.smge.input.pressed('End')) {
			console.log('end in characters');
			this.current_index = this.filtered_characters.length - 1;
			this.focus_character(this.filtered_characters[this.current_index], this.focus_duration);
		}

		// arrow left/right for navigation
		if (this.smge.input.pressed('ArrowLeft')) {
			console.log('left arrow in characters');
			this.current_index -= 1;
			if (0 > this.current_index) {
				this.current_index = this.filtered_characters.length - 1;
			}
			this.focus_character(this.filtered_characters[this.current_index], this.focus_duration);
		}
		if (this.smge.input.pressed('ArrowRight')) {
			console.log('right arrow in characters');
			this.current_index += 1;
			if (this.current_index > this.filtered_characters.length - 1) {
				this.current_index = 0;
			}
			this.focus_character(this.filtered_characters[this.current_index], this.focus_duration);
		}

		// page up/down for jump navigation
		if (this.smge.input.pressed('PageUp')) {
			console.log('page up in characters');
			let jumps = 5;
			while (0 < jumps) {
				this.current_index -= 1;
				if (0 > this.current_index) {
					this.current_index = this.filtered_characters.length - 1;
				}
				jumps -= 1;
			}
			this.focus_character(this.filtered_characters[this.current_index], this.focus_duration);
		}
		if (this.smge.input.pressed('PageDown')) {
			console.log('page down in characters');
			let jumps = 5;
			while (0 < jumps) {
				this.current_index += 1;
				if (this.current_index > this.filtered_characters.length - 1) {
					this.current_index = 0;
				}
				jumps -= 1;
			}
			this.focus_character(this.filtered_characters[this.current_index], this.focus_duration);
		}

		// arrow up/down for changing alternates if they're available
		if (this.smge.input.pressed('ArrowUp')) {
			console.log('up arrow in characters');
			this.previous_alternate(this.filtered_characters[this.current_index]);
		}
		if (this.smge.input.pressed('ArrowDown')) {
			console.log('down arrow in characters');
			this.next_alternate(this.filtered_characters[this.current_index]);
		}

		// d for details
		if (this.smge.input.pressed('d')) {
			this.details = !this.details;
			this.show_details();
		}
		// escape for leave details
		if (!this.character_details.disabled && this.smge.input.pressed('Escape')) {
			this.character_details.disable();
		}
		// s for random solo
		if (this.smge.input.pressed('s')) {
			this.choose_random(1);
		}
		// r for random pair
		if (this.smge.input.pressed('r')) {
			this.choose_random(2);
		}
		// l for lights
		if (this.smge.input.pressed('l')) {
			this.toggle_lights();
			this.set_querystring();
		}
		// c for clear filter
		if (this.smge.input.pressed('c')) {
			this.clear();
		}

		// during character selection cursor should ignore other bounds when colliding portrait
		if (!this.smge.bound_manager.check(this.portrait.bounds[0], 'during', '')) {
			// clicking a character switches focus to that character
			for (let i in this.filtered_characters) {
				let character = this.filtered_characters[i];
				if (
					this.smge.bound_manager.check(
						character.bounds[0],
						'during',
						'cursor'
					)
				) {
					this.cursor.change_state('pointer');
					// character clicks
					if (this.smge.input.released('m1')) {
						console.log('clicked character ' + character.id);
						this.focus_character(character, this.focus_duration);
					}
				}
			}
		}

		//TODO character highlight on/off effects
	}
	input_update() {
		// ensure cursor and cursor bounds are loaded before doing the rest of input update
		if (!this.cursor || !this.cursor.bounds) {
			return;
		}
		// start with default cursor and change to pointer if necessary
		this.cursor.change_state('default');
		// universal interface inputs
		this.interface_input_update();
		// filter inputs
		if (!this.filter_menu.disabled) {
			this.filter_input_update();
		}
		// otherwise character selection inputs
		else {
			this.character_input_update();
		}
		super.input_update();
	}
	open_filter_menu() {
		// set interface text to filter
		this.interface_tip.enable();
		this.interface_tip.set_text(this.buttons.filter.display);
		// disable name and portrait
		this.character_name.disable();
		this.portrait.disable();
		// store current details state
		this.filter_menu.current_state = {
			details: !this.character_details.disabled,
		};
		// lights off
		this.buttons.lights.on = false;
		// disable details
		this.character_details.disable();
		// set sprites
		this.set_all_sprites();
		// disable pip
		this.pip.disable();
		// disable interface buttons
		this.buttons.alternate.disable();
		this.buttons.link.disable();
		this.buttons.details.disable();
		this.buttons.random_pair.disable();
		this.buttons.random_solo.disable();
		this.buttons.lights.disable();
		this.buttons.clear.disable();
		// enable filter menu
		this.filter_menu.enable();
		// set current character alternate to dim base
		let character = this.characters[this.focused];
		let alternate = character.alternates[character.current_alternate];
		alternate.base.sprite.set_image(alternate.base.dim);
		for (let id in this.characters) {
			this.characters[id].disable();
		}
		// creators highlights
		if (!this.filter.creators || 0 == this.filter.creators.length) {
			this.filter.creators = [];
			for (let i in this.filter_menu.creators) {
				this.filter.creators.push(this.filter_menu.creators[i].id);
			}
		}
		for (let i in this.filter_menu.creators) {
			let creator = this.filter_menu.creators[i];
			if (-1 != this.filter.creators.indexOf(creator.id)) {
				creator.sprite.set_image(creator.dim);
			}
			else {
				creator.sprite.set_image(creator.original);
			}
		}
		// settings highlights
		if (!this.filter.settings || 0 == this.filter.settings.length) {
			console.log('empty settings filter, adding all filter menu setting ids to filter settings');
			this.filter.settings = [];
			for (let i in this.filter_menu.settings) {
				this.filter.settings.push(this.filter_menu.settings[i].id);
			}
			console.log(this.filter.settings);
		}
		for (let i in this.filter_menu.settings) {
			let setting = this.filter_menu.settings[i];
			if (-1 != this.filter.settings.indexOf(setting.id)) {
				setting.sprite.set_image(setting.dim);
			}
			else {
				setting.sprite.set_image(setting.original);
			}
		}
	}
	close_filter_menu() {
		console.log('closing filter menu');
		// enable name and portrait
		this.character_name.enable();
		this.portrait.enable();
		// restore details state
		if (this.filter_menu.current_state.details) {
			this.character_details.enable();
		}
		// set sprites
		this.set_all_sprites();
		// enable pip
		this.pip.enable();
		// enable interface buttons
		this.buttons.link.enable();
		this.buttons.details.enable();
		this.buttons.random_pair.enable();
		this.buttons.random_solo.enable();
		this.buttons.lights.enable();
		this.buttons.clear.enable();
		// disable filter menu
		this.filter_menu.disable();
		// apply current filter and place characters and refocus
		this.apply_filter();
		this.place_filtered_characters();
		this.refocus();
	}
	toggle_filter_menu() {
		if (this.filter_menu.disabled) {
			this.open_filter_menu();
		}
		else {
			this.close_filter_menu();
		}
	}
	show_details() {
		if (!this.character_details.text.text) {
			this.buttons.details.sprite.set_image(this.buttons.details.dim);
			this.character_details.disable();
		}
		else {
			this.buttons.details.sprite.set_image(this.buttons.details.original);
			if (this.details) {
				this.character_details.enable();
			}
			else {
				this.character_details.disable();
			}
		}
	}
}
