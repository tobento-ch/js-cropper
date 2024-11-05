const cropper = (function(window, document) {
    'use strict';
    
    const translator = {
        currentLocale: 'en',
        fallbacks: {},
        translations: {}, // {"de-CH": {"Message": "Translated"}}

        /**
         * Set locale.
         *
         * @param {String} locale
         */
        locale: function(locale) {
            this.currentLocale = locale;
        },

        /**
         * Set locale fallbacks.
         *
         * @param {Object} fallbacks {"de-CH": "en"}
         */
        localeFallbacks: function(fallbacks) {
            this.fallbacks = fallbacks;
        },    

        /**
         * Translate message.
         *
         * @param {String} message
         * @return {String}
         */
        trans: function(message) {
            return this.translate(message, this.currentLocale);
        },

        /**
         * Translate message.
         *
         * @param {String} message
         * @param {String} locale
         * @return {String}
         */
        translate: function(message, locale) {
            if (typeof this.translations[locale] !== 'undefined') {
                if (typeof this.translations[locale][message] !== 'undefined') {
                    return this.translations[locale][message];
                }
            }

            if (typeof this.fallbacks[locale] !== 'undefined') {
                return this.translate(message, this.fallbacks[locale]);
            }

            return message;
        },

        /**
         * Add translations for the specified locale.
         *
         * @param {String} locale
         * @param {Object} translations {"Message": "Translated"}
         */
        add: function(locale, translations) {
            let translated = {};

            if (typeof this.translations[locale] !== 'undefined') {
                translated = this.translations[locale];
            }

            this.translations[locale] = Object.assign(translated, translations);
        }
    };
    
    class Crop {
        constructor(id, imgEl, config) {
            this.id = id;
            this.config = config;
            this.imgEl = imgEl;
            this.listeners = {};
            this.destroyed = false;
            this.containerEl = this.createContainer();
            this.boxEl = this.createBox();
            
            // img data
            this.imgElW = 0; // The scaled width.
            this.imgElH = 0; // The scaled height.        
            this.imgElNaturalW = 0; // The natural width.
            this.imgElNaturalH = 0; // The natural height.
            this.imgElRatio = 0;
            this.imgElScale = 0; // The scaled factor.

            // container data
            this.containerElCssBorderLeftWidth = 0;
            this.containerElCssBorderRightWidth = 0;
            this.containerElCssBorderTopWidth = 0;
            this.containerElCssBorderBottomWidth = 0;    

            // box data.
            this.boxStartW = 0;
            this.boxStartH = 0;    
            this.boxStartX = 0;
            this.boxStartY = 0;
            this.boxMinW = 20;
            this.boxMinH = 20;
            this.box = {w: 0, h: 0, x: 0, y: 0};
            this.scale = 1;
            this.scaled = false;
            
            // active action
            this.actionEl = null;
            this.actionName = null;

            // target data.
            this.targetW = 0;
            this.targetH = 0;        
            this.maxTargetW = 0;
            this.maxTargetH = 0;

            // position
            this.positionStartX = 0;
            this.positionStartY = 0;
            this.positionX = 0;
            this.positionY = 0;

            // ratio
            this.ratio = null;
            this.keepRatio = true;
            this.boxChangedToKeepRatio = false;
            
            // messages
            this.hasMessages = false;
            this.messages = {};

            this.init();
            
            // event listeners:
            this.startListener = (e) => this.startHandler(e);
            this.stopListener = (e) => this.stopHandler(e);
            this.moveListener = (e) => this.moveHandler(e);
            
            // add event listeners:
            this.boxEl.addEventListener('mousedown', this.startListener, false);
            this.boxEl.addEventListener('touchstart', this.startListener, false);
            
            // scale and wheel:
            this.wheelEventEndTimeout = null;
            
            this.containerEl.addEventListener('wheel', (event) => {
                event.preventDefault();

                if (event.deltaY < 0) {
                    this.scale = this.scale+0.05;
                } else {
                    this.scale = this.scale-0.05;
                }

                // Restrict scale
                if (this.scale < 0.1) {
                    this.scale = 0.1;
                }
            
                // Apply scale transform
                this.imgEl.style.transform = 'scale('+this.scale+')';
                
                this.wheelEventEndTimeout = setTimeout(() => {
                    this.update();
                    this.fire('stopped', [event, this]);
                }, 100);
            });
        }
        createContainer() {
            const el = document.createElement('div');
            el.setAttribute('class', 'crop-container');
            this.imgEl.parentNode.insertBefore(el, this.imgEl.nextSibling);
            el.appendChild(this.imgEl);
            return el;
        }
        createBox() {
            const el = document.createElement('div');
            el.setAttribute('class', 'crop-box');
            el.setAttribute('data-crop-action', 'box');
            this.containerEl.appendChild(el);
            
            if (this.keepRatio === false) {
                this.addBoxHandler('n');
                this.addBoxHandler('w');
                this.addBoxHandler('e');
                this.addBoxHandler('s');
            }

            this.addBoxPoint('nw', el);
            this.addBoxPoint('ne', el);
            this.addBoxPoint('sw', el);
            this.addBoxPoint('se', el);
            
            return el;
        }
        addBoxPoint(key, boxEl) {
            const el = document.createElement('div');
            el.setAttribute('class', 'crop-point crop-point-'+key);
            el.setAttribute('data-crop-action', key);
            boxEl.appendChild(el);
        }
        init() {
            // If only one target is set do not keep ratio for default.
            if (typeof this.config['target'] !== 'undefined') {
                const target = this.config['target'];
                if (typeof target[0] === 'undefined' || target[0] === null) {
                    this.keepRatio = false;
                }
                if (typeof target[1] === 'undefined' || target[1] === null) {
                    this.keepRatio = false;
                }
            }
            
            // Check for keep_ratio config.
            if (typeof this.config['keep_ratio'] !== 'undefined') {
                this.keepRatio = (this.config['keep_ratio'] === false) ? false : true;
            }
            
			// Ensure that image has loaded for getting right dimensions.
			if ((this.imgEl.complete && this.imgEl.naturalHeight !== 0) === false) {
				this.imgEl.addEventListener('load', () => {
                    this.scaled = false;
                    if (this.destroyed) { return; }
					this.prepareData();
					// if browser window gets resized, we should recall these function below to recaluclate the data.
					this.prepareDataVary();
				}, false);
			} else {
				this.prepareData();
				// if browser window gets resized, we should recall these function below to recaluclate the data.
				this.prepareDataVary();
			}
        }
        destroy() {
            this.destroyed = true;
            this.boxEl.remove();
            this.imgEl.removeAttribute('style');
            
            if (this.messagesEl) {
                this.messagesEl.remove();
            }
            
            this.containerEl.replaceWith(...this.containerEl.childNodes);
            
            cropper.delete(this.id);
        }
        
        /**
         * Prepare the fixed data.
         */
        prepareData() {
            // Store img dimension:
            this.imgElNaturalW = this.imgEl.naturalWidth;
            this.imgElNaturalH = this.imgEl.naturalHeight;
            this.imgElRatio = Math.abs(this.imgElNaturalW/this.imgElNaturalH);
            
            // Get the default crop data if set:
            if (typeof this.config['crop'] !== 'undefined') {
                const crop = this.config['crop'];
                if (typeof crop['width'] !== 'undefined') {
                    this.box.w = parseInt(crop['width']);
                }                    
                if (typeof crop['height'] !== 'undefined') {
                    this.box.h = parseInt(crop['height']);
                }
                if (typeof crop['x'] !== 'undefined') {
                    this.box.x = parseInt(crop['x']);
                }    
                if (typeof crop['y'] !== 'undefined') {
                    this.box.y = parseInt(crop['y']);
                }
                if (typeof crop['scale'] !== 'undefined') {
                    this.scale = crop['scale'];
                    this.imgEl.style.transform = 'scale('+this.scale+')';
                }
            }
            
            // Determine the ratio
            if (typeof this.config['target'] !== 'undefined') {
                this.ratio = this.calculateTargetRatio(this.config['target']);
            }
            
            // Set default ratio if not target is not defined or not valid.
            if (this.ratio === null) {
                this.ratio = this.imgElRatio; // default ratio if config target is not set.
            }
        }
        
        /**
         * Prepare the data which may vary if resizing.
         */
        prepareDataVary() {
            //this.imgElW = this.imgEl.width;
            this.imgElW = this.imgEl.clientWidth; /*Safari fix*/
            
            // Determine the img scaled factor.
            this.imgElScale = this.imgElNaturalW/this.imgElW;
            this.imgElH = (this.imgElNaturalH/this.imgElScale);
                        
            // Store some css data.
            this.containerElCssBorderLeftWidth = parseInt(window.getComputedStyle(this.containerEl).getPropertyValue('border-left-width'));
            this.containerElCssBorderRightWidth = parseInt(window.getComputedStyle(this.containerEl).getPropertyValue('border-right-width'));
            this.containerElCssBorderTopWidth = parseInt(window.getComputedStyle(this.containerEl).getPropertyValue('border-top-width'));
            this.containerElCssBorderBottomWidth = parseInt(window.getComputedStyle(this.containerEl).getPropertyValue('border-bottom-width'));

            // Check for display: none;
            const containerElRect = this.containerEl.getBoundingClientRect();
            
            if (containerElRect.width === 0 && containerElRect.height === 0) {
                this.renderMessage('Could not detect the image width and height!', 'couldNotDetectImageScale');
            } else {
                this.deleteMessage('couldNotDetectImageScale');
            }
            
            // set container width and height based on imgEl.
            // This fixes some issues. But we will loose responsiveness. Nevermind, we need to update things on resize anyway.
            this.containerEl.style.width = (this.imgElW+this.containerElCssBorderLeftWidth+this.containerElCssBorderRightWidth)+'px';
            this.containerEl.style.height = (this.imgElH+this.containerElCssBorderTopWidth+this.containerElCssBorderBottomWidth)+'px';
            
            // Recalculate crop based on img scale data.
            this.box.w = this.box.w/this.imgElScale;
            this.box.h = this.box.h/this.imgElScale;
            this.box.x = this.box.x/this.imgElScale;
            this.box.y = this.box.y/this.imgElScale;

            // Verify that crop data are inside containerEl, otherwise adjust. Checks also if keep ratio is set to true.
            const verifiedCrop = this.verifyCropData(this.box.w, this.box.h, this.box.x, this.box.y);
            
            // reassign verified crop data.
            this.box.w = verifiedCrop.w;
            this.box.h = verifiedCrop.h;
            this.box.x = verifiedCrop.x;
            this.box.y = verifiedCrop.y;
            
            // apply scale once:
            if (!this.scaled) {
                const ws = this.imgElW - (this.imgElW*this.scale);
                const hs = this.imgElH - (this.imgElH*this.scale);
                
                this.box.w = Math.round(this.box.w-ws/2);
                this.box.h = Math.round(this.box.h-hs/2);
                this.box.x = Math.round(this.box.x+ws/2);
                this.box.y = Math.round(this.box.y+hs/2);
                
                this.scaled = true;
            }

            // set cropEl based on crop data.
            this.boxEl.style.width = this.box.w+'px';
            this.boxEl.style.height = this.box.h+'px';
            this.boxEl.style.left = this.box.x+'px';
            this.boxEl.style.top = this.box.y+'px';

            // Check if crop area is not too small.
            if (this.box.w*this.imgElScale < this.targetW || this.box.h*this.imgElScale < this.targetH) {
                this.renderMessage('The image quality may suffer as the crop area is too small!');
            }

            // Check if img is not too small.
            if (this.imgElNaturalW < this.maxTargetW || this.imgElNaturalH < this.maxTargetH) {
                this.renderMessage('The image is too small and thereby the image quality may suffer!');
            }
        }

        /**
         * Updates the data for crop. This will override already changed crop data.
         */
        update() {
            // remove the container style, as to resize.
            this.containerEl.removeAttribute('style');
            
            // Recalculate crop based on img scale data.
            this.box.w = this.box.w*this.imgElScale;
            this.box.h = this.box.h*this.imgElScale;
            this.box.x = this.box.x*this.imgElScale;
            this.box.y = this.box.y*this.imgElScale;
            
            this.prepareDataVary();
        }
        
        /**
         * Set the target.
         *
         * @param object The target data. [600, 500] or [600] or [null, 800]
         */
        setTarget(target) {
            var ratio = this.calculateTargetRatio(target);

            // Keep default ratio if target is not defined or not valid.
            if (ratio === null) {
                return;
            }
            
            this.ratio = ratio;
            
            // update
            this.update();
        }
        
        /**
         * Calculates the ratio based on the config target. 
         *
         * @param object The target data. [600, 500] or [600] or [null, 800]
         * @return int The ratio
         */
        calculateTargetRatio(configTarget) {
            
            var targetW = 0,
                targetH = 0;
            
            if (typeof configTarget === 'undefined') {
                return 0;
            }
            
            if (typeof configTarget[0] !== 'undefined') {
                targetW = parseInt(configTarget[0]);
            }
            if (typeof configTarget[1] !== 'undefined') {
                targetH = parseInt(configTarget[1]);
            }

            if (targetW === 0 && targetH === 0) {
                return 0;
            }

            // if target width is not set, calculate based on height and img element.
            if (targetW === 0 || isNaN(targetW)) {
                targetW = this.imgElNaturalW/(this.imgElNaturalH/targetH);
            }
            
            // if target height is not set, calculate based on width and img element.
            if (targetH === 0 || isNaN(targetH)) {
                targetH = this.imgElNaturalH/(this.imgElNaturalW/targetW);
            }
            
            // set max target width and height.
            if (targetW > this.maxTargetW) { this.maxTargetW = targetW; }
            if (targetH > this.maxTargetH) { this.maxTargetH = targetH; }

            if (isNaN(targetW)) {
                targetW = 0;
            }
            
            if (isNaN(targetH)) {
                targetH = 0;
            }

            this.targetW = targetW;
            this.targetH = targetH;
            
            return Math.abs(targetW/targetH);
        }
        
        /**
         * Verfiy the given crop data. 
         * - within the container boundry.
         * - not below min width and min height set.
         * - keep ratio is set to true.
         *
         * @param int The width.
         * @param int The height.
         * @param int The x coordinate.
         * @param int The y coordinate.
         * @return object The verfied or adjusted crop data {w: 0, h: 0, x: 0, y: 0}
         */
        verifyCropData(w, h, x, y) {
            var containerSizeMin = Math.min(this.imgElW, this.imgElH),
                minSizeMax = Math.max(this.boxMinW, this.boxMinH),
                calcCenter = false;
            
            if (isFinite(w) === false) { w = this.imgElW; }
            if (isFinite(h) === false) { h = this.imgElH; }
            if (isFinite(x) === false) { x = 0; }
            if (isFinite(y) === false) { y = 0; }
            
            if (w === 0 && h === 0) {
                w = this.imgElW;
                h = this.imgElH;
                calcCenter = true;
            }
            
            // keep ratio
            if (this.keepRatio === true) {
                
                var ratioCrop = (w*this.imgElScale)/(h*this.imgElScale),
                    ratioDiff = Math.abs(ratioCrop - this.ratio);
                
                if (ratioCrop !== this.ratio && ratioDiff > 0.02) {
                    
                    w = this.imgElW;
                    h = w/this.ratio;

                    if (h > this.imgElH) {
                        h = this.imgElH;
                        w = h*this.ratio;
                    }
                    x = 0;
                    y = 0;
                    
                    // check min for ratio change.
                    if (w < this.boxMinW || h < this.boxMinH) {
                        this.renderMessage('Cannot keep the minimal crop data set for the area.');
                    }
                    
                    this.boxChangedToKeepRatio = true;
                }
            }
            
            if (calcCenter === true) {
                return this.calculateCropCenter(w, h, x, y, this.imgElW, this.imgElH);
            }
            
            if (this.boxChangedToKeepRatio === true) {
                return {w: w, h: h, x: Math.round(x), y: Math.round(y)};
            }
            
            // Check min width and height.
            if (w < this.boxMinW) {
                this.renderMessage('Cannot keep the minimal crop data set for the area.');
            }
            if (h < this.boxMinH) {
                this.renderMessage('Cannot keep the minimal crop data set for the area.');
            }
            
            // recheck min.
            if (w < this.boxMinW || h < this.boxMinH || w == 'Infinity' || h == 'Infinity') {
                this.renderMessage('Invalid target data set, cannot keep ratio!');
            }
            
            // Check if at least width and height is set or not 0, otherwise set them based on img.
            if (w <= 0 || w > (this.imgElW+0.02)) {
                w = this.imgElW;
                if (this.keepRatio === true) {
                    w = containerSizeMin;
                    h = w/this.ratio;
                }
            }
            
            if (h <= 0 || h > (this.imgElH+0.02)) {
                h = this.imgElH;
                if (this.keepRatio === true) {
                    h = containerSizeMin;
                    w = h/this.ratio;
                }
            }

            // check position.
            if (x+w > (this.imgElW+0.02)) {
                x = 0;
            }
            if (y+h > (this.imgElH+0.02)) {
                y = 0;
            }
            
            return {w: w, h: h, x: Math.round(x), y: Math.round(y)};
        }

        /**
         * Calculates the crop center. 
         *
         * @param int The width.
         * @param int The height.
         * @param int The x coordinate.
         * @param int The y coordinate.
         * @param int The img width.
         * @param int The img height.
         * @return object The centered crop data {w: 0, h: 0, x: 0, y: 0}
         */
        calculateCropCenter(w, h, x, y, imgW, imgH) {
            x = x + (imgW/2)-(w/2);
            y = y + (imgH/2)-(h/2);
            
            return {w: w, h: h, x: Math.round(x), y: Math.round(y)};
        }
        startHandler(event) {
            event.preventDefault();

            if (event.type === 'touchstart') {
                const touchEvent = event.touches[0];
                
                // Set the active action el
                this.actionEl = touchEvent.target;

                // Store position
                this.positionStartX = touchEvent.clientX;
                this.positionStartY = touchEvent.clientY;
            } else {
                // Set the active action el
                this.actionEl = event.target;
                
                // Store position
                this.positionStartX = event.clientX;
                this.positionStartY = event.clientY;
            }
            
            // Set the action name.
            this.actionName = this.actionEl.getAttribute('data-crop-action');
            
            // Set the cursor to the document if outside of the action element based on CSS.
            const cursorCss = window.getComputedStyle(this.actionEl).getPropertyValue('cursor');
            document.body.style.cursor = cursorCss;
            if (this.actionName !== 'box') {
                this.boxEl.style.cursor = cursorCss;
            }
            
            // store box position data.
            this.boxStartW = this.box.w;
            this.boxStartH = this.box.h;
            this.boxStartX = this.box.x;
            this.boxStartY = this.box.y;
                        
            // add events.
            document.addEventListener('mousemove', this.moveListener, false);
            document.addEventListener('mouseup', this.stopListener, false);
            document.addEventListener('touchmove', this.moveListener, false);
            document.addEventListener('touchend', this.stopListener, false);
            
            this.fire('started', [event, this]);
        }
        stopHandler(event) {
            if (event.type === 'touchend') {
                if (event.touches.length == 0) {
                    event = event.changedTouches[0];
                }
            }
            
            this.actionEl = null;
            
            // reset cursor style.
            document.body.style.removeProperty('cursor');
            this.boxEl.style.removeProperty('cursor');
            
            // get new box position data
            const boxPos = this.getPosition(this.boxEl);
            
            this.box.w = boxPos.w;
            this.box.h = boxPos.h;
            this.box.x = boxPos.x;
            this.box.y = boxPos.y;
            
            // remove events.
            document.removeEventListener('mousemove', this.moveListener, false);
            document.removeEventListener('mouseup', this.stopListener, false);
            document.removeEventListener('touchmove', this.moveListener, false);
            document.removeEventListener('touchend', this.stopListener, false);
            
            this.fire('stopped', [event, this]);
        }
        moveHandler(event) {
            event.preventDefault();
            
            if (event.type == 'touchmove') {
                event = event.touches[0];
            }
            
            // normalize position.
            this.positionX = event.clientX-this.positionStartX,
            this.positionY = event.clientY-this.positionStartY;
            
            // keep ratio
            if (this.keepRatio === true) {
                if (this.actionName == 'ne' || this.actionName == 'sw') {
                    this.positionY = -Math.round(this.positionX/this.ratio);
                }
                if (this.actionName == 'nw' || this.actionName == 'se') {
                    this.positionY = Math.round(this.positionX/this.ratio);
                }
            }
            
            // resize boxEl based on which action is moved.
            switch(this.actionName) {
                case 'box':
                    this.boxEl.style.left = this.boxStartX+this.positionX+'px';
                    this.boxEl.style.top = this.boxStartY+this.positionY+'px';
                    this.limitBox(this.boxStartX+this.positionX, this.boxStartY+this.positionY);
                    break;
                case 'n':
                    var limit = this.limit(
                        this.boxStartX,
                        this.boxStartY+this.positionY,
                        this.boxMinW,
                        this.boxStartH-this.positionY
                    );
                    
                    this.applyStyle('height', limit.h);
                    this.applyStyle('top', limit.y);
                    break;
                case 'w':
                    var limit = this.limit(
                        this.boxStartX+this.positionX,
                        0,
                        this.boxStartW-this.positionX,
                        this.boxStartH
                    );
                    
                    this.applyStyle('width', limit.w);
                    this.applyStyle('left', limit.x);
                    break;
                case 'e':
                    var limit = this.limit(
                        this.boxStartX,
                        this.boxStartY,
                        this.boxStartW+this.positionX,
                        this.boxStartH
                    );
                    
                    this.applyStyle('width', limit.w);
                    break;
                case 's':
                    var limit = this.limit(
                        this.boxStartX,
                        this.boxStartY,
                        this.boxMinW,
                        this.boxStartH+this.positionY
                    );
                    
                    this.applyStyle('height', limit.h);
                    break;
                case 'nw':
                    var limit = this.limit(
                        this.boxStartX+this.positionX,
                        this.boxStartY+this.positionY,
                        this.boxStartW-this.positionX,
                        this.boxStartH-this.positionY
                    );
                    
                    this.applyStyle('width', limit.w);
                    this.applyStyle('left', limit.x);
                    this.applyStyle('height', limit.h);
                    this.applyStyle('top', limit.y);
                    break;
                case 'ne':
                    var limit = this.limit(
                        this.boxStartX,
                        this.boxStartY+this.positionY,
                        this.boxStartW+this.positionX,
                        this.boxStartH-this.positionY
                    );
                    
                    this.applyStyle('width', limit.w);
                    this.applyStyle('height', limit.h);
                    this.applyStyle('top', limit.y);
                    break;
                case 'sw':
                    var limit = this.limit(
                        this.boxStartX+this.positionX,
                        this.boxStartY,
                        this.boxStartW-this.positionX,
                        this.boxStartH+this.positionY
                    );
                    
                    this.applyStyle('width', limit.w);
                    this.applyStyle('left', limit.x);
                    this.applyStyle('height', limit.h);
                    break;
                case 'se':
                    var limit = this.limit(
                        this.boxStartX,
                        this.boxStartY,
                        this.boxStartW+this.positionX,
                        this.boxStartH+this.positionY
                    );
                    
                    this.applyStyle('width', limit.w);
                    this.applyStyle('height', limit.h);
                    break;
            }
                        
            this.fire('moving', [event, this]);
        }

        applyStyle(pos, value) {
            if (! Number.isInteger(value)) { return; }
            this.boxEl.style[pos] = value+'px';
        }
        
        /**
         * Limit box while dragging to the container boundry.
         */
        limitBox(positionX, positionY) {
            var minX = 0,
                maxX = this.imgElW-this.boxStartW,
                minY = 0,
                maxY = this.imgElH-this.boxStartH;
            
            if (positionX < minX) {
                this.boxEl.style.left = minX+'px';
            }
            
            if (positionX > maxX) {
                this.boxEl.style.left = maxX+'px';
            }

            if (positionY < minY) {
                this.boxEl.style.top = minY+'px';
            }
            
            if (positionY > maxY) {
                this.boxEl.style.top = maxY+'px';
            }
        }
            
        /**
         * Limit box while scaling to the container boundry.
         */
        limit(x, y, w, h) {
            // Check if crop area is not too small.
            if (w*this.imgElScale < this.targetW || h*this.imgElScale < this.targetH) {
                this.renderMessage('The image quality may suffer as the crop area is too small!', 'areaTooSmall');
            } else {
                this.deleteMessage('areaTooSmall');
            }
            
            // limit boundry left.
            if (x < 0) {
                w = null, x = 0;
                if (this.keepRatio === true) { h = null, y = null; }
            }

            // limit boundry top.
            if (y < 0) {
                y = 0, h = null;
                if (this.keepRatio === true) { w = null, x = null; }
            }
            
            // limit boundry right.
            if (x+w > this.imgElW) {
                w = this.imgElW-this.boxStartX;
                if (this.keepRatio === true) { h = null, y = null; }
            }
            
            // limit boundry bottom.
            if (y+h > this.imgElH) {
                h = this.imgElH-this.boxStartY;
                if (this.keepRatio === true) { w = null, x = null; }
            }

            // limit min width
            if (w < this.boxMinW && w !== null) {
                w = this.boxMinW, x = null;
                if (this.keepRatio === true) { w = null, h = null, y = null; }
            }

            // limit min height
            if (h < this.boxMinH && h !== null) {
                h = this.boxMinH, y = null;
                if (this.keepRatio === true) { h = null, w = null, x = null; }
            }
            
            return {x: x, y: y, w: w, h: h};
        }
        getPosition(el) {
            const elRect = el.getBoundingClientRect();
            
            return {
                w: elRect.width,
                h: elRect.height,
                x: parseInt(window.getComputedStyle(el).getPropertyValue('left')),
                y: parseInt(window.getComputedStyle(el).getPropertyValue('top'))
            };
        }
        data() {
            const ws = this.imgElW - (this.imgElW*this.scale);
            const hs = this.imgElH - (this.imgElH*this.scale);
            
            return {
                width: Math.round((this.box.w+ws)*this.imgElScale),
                height: Math.round((this.box.h+hs)*this.imgElScale),
                x: Math.round((this.box.x-ws/2)*this.imgElScale),
                y: Math.round((this.box.y-hs/2)*this.imgElScale),
                scale: this.scale,
            };
        }
        listen(eventName, callback) {
            if (typeof this.listeners[eventName] === 'undefined') {
                this.listeners[eventName] = [];
            }
            
            this.listeners[eventName].push(callback);
        }
        fire(eventName, parameters) {
            if (typeof this.listeners[eventName] === 'object') {
                this.listeners[eventName].forEach(listener => {
                    if (typeof listener === 'function') {
                        if (parameters instanceof Array) {
                            listener(...parameters);
                        } else if (parameters instanceof Object) {
                            listener(parameters);
                        }
                    }
                });
            }
        }
        renderMessage(message, storeKey) {
            if (typeof storeKey === 'undefined') {
                storeKey = message;
            }
            
            if (this.hasMessages === false) {
                this.messages = {};
                
                // create message container if not already exist.
                this.messagesEl = document.createElement('div');
                this.messagesEl.setAttribute('class', 'crop-messages');
                
                if (this.containerEl.parentNode) {
                    this.containerEl.parentNode.appendChild(this.messagesEl);
                }
                
                this.hasMessages = true;
            }

            if (typeof this.messages[storeKey] !== 'undefined') {
                return;
            }
            
            const div = document.createElement('div');
            div.innerHTML = translator.trans(message);
            div.setAttribute('class', 'crop-message');
            this.messagesEl.appendChild(div);
            this.messages[storeKey] = div;
        }

        /**
         * Deletes a message rendered.
         *
         * @param string The store key.
         */
        deleteMessage(storeKey) {
            if (typeof this.messages[storeKey] !== 'undefined') {
                var el = this.messages[storeKey];
                el.parentNode.removeChild(el);
                delete this.messages[storeKey];
            }
        }
    }

    const cropper = {
        translator: translator,
        items: {},
        register: function() {
            const crops = document.querySelectorAll('[data-crop]');
            
            crops.forEach(el => {
                const config = JSON.parse(el.getAttribute('data-crop'));
                
                if (typeof config['id'] === 'undefined') {
                    return;
                }
                
                if (el.tagName.toLowerCase() !== 'img') {
                    return;
                }
                
                el.removeAttribute('data-crop');
                el.setAttribute('data-crop-id', config['id']);
                
                if (this.has(config['id'])) {
                    return;
                }
                
                this.set(config['id'], new Crop(config['id'], el, config));
            });
        },
        set: function(id, obj) {
            this.items[id] = obj;
        },
        get: function(id) {
            return this.items[id];
        },
        delete: function(id) {
            delete this.items[id];
        },
        has: function(id) {
            return (typeof this.items[id] === 'undefined') ? false : true;
        },
        create: function(el, config = {}) {
            if (!el) {
                return;
            }
            
            if (el.tagName.toLowerCase() !== 'img') {
                return;
            }
            
            if (typeof config['id'] === 'undefined') {
                return;
            }

            if (! this.has(config['id'])) {
                this.set(config['id'], new Crop(config['id'], el, config));
            }
            
            return this.items[config['id']];
        }
    };
    
    document.addEventListener('DOMContentLoaded', (e) => {
        cropper.register();
    });
    
    return cropper;
    
})(window, document);

export default cropper;