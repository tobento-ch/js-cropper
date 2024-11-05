# JS Cropper

Simple JavaScript Image Cropper.

You may visit the [**docs.tobento.ch/js-cropper**](https://docs.tobento.ch/js-cropper) page for demo.

## Table of Contents

- [Getting started](#getting-started)
    - [Browser support](#browser-support)
- [Documentation](#documentation)
    - [Basic Usage](#basic-usage)
    - [Options](#options)
    - [Methods](#methods)
    - [Events](#events)
    - [Translations](#translations)
- [Credits](#credits)
___

# Getting started

## Browser support

Modern browser only.

# Documentation

## Basic Usage

**1. Include CSS/JS**

```html
<link href="cropper.css" rel="stylesheet" type="text/css">
<script src="cropper.js" type="module"></script>
```

**2. Register**

Use the ```data-crop``` attribute to automatically register the images.

```html
<!-- minimum requirement -->
<img src="image.jpg" data-crop='{"id": "uniqueID"}'>

<!-- with all options -->
<img src="image.jpg" data-crop='{"id": "image1", "target": [1200, 600], "crop": {"x":100,"y":200,"width":900,"height":450,"scale":1}, "keep_ratio": true}'>
```

Thats all.

**You may get the crop data**

```html
<script type="module">
    import cropper from "cropper.js";

    document.addEventListener('DOMContentLoaded', (e) => {
        const cropData = cropper.get('image1').data();
        
        // or using the stopped event
        cropper.get('image1').listen('stopped', (e, crop) => {
            const cropData = crop.data();
        });
    });
</script>
```

**Manually creating**

Instead of using the ```data-crop``` attribute to register the crop automatically, you can create the crop manually by using the ```create``` function:

```html
<script type="module">
    import cropper from "cropper.js";

    document.addEventListener('DOMContentLoaded', (e) => {
        // create it manually:
        const crop = cropper.create(document.querySelector('#image'), {
            id: 'foo',
            target: [1200, 600],
            crop: {
                x: 100,
                y: 200,
                width: 900,
                height: 450,
                scale: 1
            },
            keep_ratio: true
        });
        
        // you may get the crop data using the stopped event:
        crop.listen('stopped', (event, crop) => {
            const cropData = crop.data();
        });
    });
</script>
```

## Options

```html
<img src="image.jpg" data-crop='{"id": "imageID", "target": [1200, 600], "crop": {"x":100,"y":200,"width":900,"height":450,"scale":1}, "keep_ratio": true}'>
```

| Option | Value | Description |
| --- | --- | --- |
| ```"id"``` | ```"ID"``` | A unique id. |
| ```"target"``` | ```[1200, 600]```, ```[1200]``` or ```[null, 600]``` | A target image width and/or height. (optional) |
| ```"crop"``` | ```null``` | Crop data. (optional) |
| ```"keep_ratio"``` | ```true``` or ```false``` | If to keep the image ratio. (optional) |

### Methods

```html
<script type="module">
    import cropper from "cropper.js";

    document.addEventListener('DOMContentLoaded', (e) => {
        // create a crop object:
        const crop = cropper.create(document.querySelector('#image'), {
            id: 'ID',
            target: [1200, 600],
            crop: {
                x: 100,
                y: 200,
                width: 900,
                height: 450,
                scale: 1
            },
            keep_ratio: true
        });
        
        // you may get a crop object by id:
        const crop = cropper.get('ID');
        
        // you may check if a crop object exists:
        if (cropper.has('ID')) {
            cropper.get('ID');
        }
        
        // you may get the crop data:
        const cropData = crop.data();
        
        // you may destroy the crop:
        crop.destroy();
    });
</script>
```

### Events

| Event |  Description |
| --- | --- |
| ```started``` | This event is fired **after** the crop area is started being moved. |
| ```stopped``` | This event is fired **after** the crop area is stopped being moved. |
| ```moving``` | This event is fired **while** moving the crop area. |

```js
cropper.get('ID').listen('stopped', (event, crop) => {
    const cropData = crop.data();
});
```

## Translations

```html
<script type="module">
    import cropper from "cropper.js";

    const translator = cropper.translator;
    
    // specify the current locale:
    translator.locale('de-CH');
    // or translator.locale(document.querySelector('html').getAttribute('lang'));
    //translator.localeFallbacks({"de-CH": "en"});
    
    // add translations:
    translator.add('de-CH', {
        "Cannot keep the minimal crop data set for the area.": "Das minimale Crop-Area kann nicht beibehalten werden.",
        "Could not detect the image width and height!": "Die Bildbreite und -höhe konnte nicht ermittelt werden!",
        "Invalid target data set, cannot keep ratio!": "Ungültige Zieldimension, Verhältnis kann nicht eingehalten werden!",
        "The image is too small and thereby the image quality may suffer!": "Das Bild ist zu klein und dadurch kann die Bildqualität leiden!",
        "The image quality may suffer as the crop area is too small!": "Die Bildqualität kann leiden, da der Zuschneidebereich zu klein ist!"
    });
</script>
```

# Credits

- [Tobias Strub](https://www.tobento.ch)
- [All Contributors](../../contributors)