/*global H5P,ns*/
var H5PEditor = H5PEditor || {};

/**
 * Create a field for the form.
 *
 * @param {mixed} parent
 * @param {Object} field
 * @param {mixed} params
 * @param {function} setValue
 * @returns {H5PEditor.Text}
 */
H5PEditor.BookMaker = function (parent, field, params, setValue) {
  var that = this;
  H5P.DragNBar.FormManager.call(this, parent, {
    doneButtonLabel: H5PEditor.t('H5PEditor.BookMaker', 'done'),
    deleteButtonLabel: H5PEditor.t('H5PEditor.BookMaker', 'remove'),
    expandBreadcrumbButtonLabel: H5PEditor.t('H5PEditor.BookMaker', 'expandBreadcrumbButtonLabel'),
    collapseBreadcrumbButtonLabel: H5PEditor.t('H5PEditor.BookMaker', 'collapseBreadcrumbButtonLabel')
  }, 'bookmaker');

  if (params === undefined) {
    params = {
      scenes: [{
        elements: []
      }]
    };

    setValue(field, params);
  }

  this.parent = parent;
  this.field = field;
  this.params = params;
  // Elements holds a mix of forms and params, not element instances
  this.elements = [];
  this.sceneRatio = 16 / 9;

  this.passReadies = true;
  parent.ready(function () {
    that.passReadies = false;

    // Remove editor form title for custom editor
    parent.$form.find('.field-name-book .h5peditor-label-wrapper').first().text('');

    // Remove redundant fullscreen bar
    parent.$form.find('.form-manager-head').first().remove();
  });

  if (H5PEditor.InteractiveVideo !== undefined) {
    // Disable IV's guided tour within CP
    H5PEditor.InteractiveVideo.disableGuidedTour();
  }

  // Update paste button
  H5P.externalDispatcher.on('datainclipboard', function (event) {
    if (!that.libraries) {
      return;
    }
    var canPaste = !event.data.reset;
    if (canPaste) {
      // Check if content type is supported here
      canPaste = that.canPaste(H5P.getClipboard());
    }
    that.dnb.setCanPaste(canPaste);
  });
};

H5PEditor.BookMaker.prototype = Object.create(H5P.DragNBar.FormManager.prototype);
H5PEditor.BookMaker.prototype.constructor = H5PEditor.BookMaker;

/**
 * Must be changed if the semantics for the elements changes.
 * @type {string}
 */
H5PEditor.BookMaker.clipboardKey = 'H5PEditor.BookMaker';

/**
 * Will change the size of all elements using the given ratio.
 *
 * @param {number} heightRatio
 */
H5PEditor.BookMaker.prototype.updateElementSizes = function (heightRatio) {
  const $scenes = this.bookMaker.$scenesWrapper.children();

  // Go through all scenes
  for (let i = 0; i < this.params.scenes.length; i++) {
    const scene = this.params.scenes[i];
    const $sceneElements = $scenes.eq(i).children();

    for (let j = 0; j < scene.elements.length; j++) {
      const element = scene.elements[j];

      // Update params
      element.height *= heightRatio;
      element.y *= heightRatio;

      // Update visuals if possible
      $sceneElements.eq(j).css({
        height: element.height + '%',
        top: element.y + '%'
      });
    }
  }
};

/**
 * Add an element to the current scene and params.
 *
 * @param {string|object} library Content type or parameters
 * @param {object} [options] Override the default options
 * @returns {object}
 */
H5PEditor.BookMaker.prototype.addElement = function (library, options) {
  options = options || {};

  var elementParams;
  if (!(library instanceof String || typeof library === 'string')) {
    elementParams = library;
  }

  if (!elementParams) {
    // Create default start parameters
    elementParams = {
      x: 30,
      y: 30,
      width: 40,
      height: 40
    };

    elementParams.action = (options.action ? options.action : {
      library: library,
      params: {}
    });
    elementParams.action.subContentId = H5P.createUUID();

    var libraryName = library.split(' ')[0];
    switch (libraryName) {
      case 'H5P.Audio':
        elementParams.x = 2.7933; // CSS Percent
        elementParams.y = 71.9603; // CSS Percent
        elementParams.width = 120 / 16;
        elementParams.height = 120 / 9;
        elementParams.action.params.fitToWrapper = true;

        this.dnbPositionOverride = {
          x: elementParams.x,
          y: elementParams.y
        };
        break;
    }

    if (options.width && options.height) {
      // Use specified size
      elementParams.width = options.width;
      elementParams.height = options.height * this.sceneRatio;
    }
  }
  if (options.pasted) {
    elementParams.pasted = true;
  }

  var sceneIndex = this.bookMaker.$current.index();
  var sceneParams = this.params.scenes[sceneIndex];

  if (sceneParams.elements === undefined) {
    // No previous elements
    sceneParams.elements = [elementParams];
  }
  else {
    var containerStyle = window.getComputedStyle(this.dnb.$container[0]);
    var containerWidth = parseFloat(containerStyle.width);
    var containerHeight = parseFloat(containerStyle.height);

    // Make sure we don't overlap another element
    var pToPx = containerWidth / 100;
    var pos = {
      x: elementParams.x * pToPx,
      y: (elementParams.y * pToPx) / this.sceneRatio
    };
    this.dnb.avoidOverlapping(pos, {
      width: (elementParams.width / 100) * containerWidth,
      height: (elementParams.height / 100) * containerHeight,
    });

    elementParams.x = pos.x / pToPx;
    elementParams.y = (pos.y / pToPx) * this.sceneRatio;

    // Add as last element
    sceneParams.elements.push(elementParams);
  }

  this.bookMaker.$boxWrapper.add(this.bookMaker.$boxWrapper.find('.h5p-presentation-wrapper:first')).css('overflow', 'visible');

  const element = this.bookMaker.children[sceneIndex].addChild(elementParams);

  return this.bookMaker.attachElement(elementParams, element.instance, this.bookMaker.$current, sceneIndex);
};

/**
 * Append field to wrapper.
 *
 * @param {type} $wrapper
 * @returns {undefined}
 */
H5PEditor.BookMaker.prototype.appendTo = function ($wrapper) {
  var that = this;

  this.$item = H5PEditor.$(this.createHtml()).appendTo($wrapper);
  this.$editor = this.$item.children('.editor');
  this.$errors = this.$item.children('.h5p-errors');

  // Create new presentation.
  var presentationParams = (this.parent instanceof ns.Library ? this.parent.params.params : this.parent.params);
  this.bookMaker = new H5P.BookMaker(presentationParams, H5PEditor.contentId, {bookMakerEditor: this});
  this.bookMaker.attach(this.$editor);
  if (this.bookMaker.$wrapper.is(':visible')) {
    this.bookMaker.trigger('resize');
  }
  var $settingsWrapper = H5PEditor.$('<div>', {
    'class': 'h5p-settings-wrapper hidden',
    appendTo: that.bookMaker.$boxWrapper.children('.h5p-presentation-wrapper')
  });


  // Add drag and drop menu bar.
  that.initializeDNB();

  // Find BG selector fields and init scene selector
  var globalBackgroundField = H5PEditor.BookMaker.findField('globalBackgroundSelector', this.field.fields);
  var sceneFields = H5PEditor.BookMaker.findField('scenes', this.field.fields);
  this.backgroundSelector = new H5PEditor.BookMaker.SceneSelector(that, that.bookMaker.$scenesWrapper, globalBackgroundField, sceneFields, that.params)
    .appendTo($settingsWrapper);

  // Add and bind scene controls.
  var sceneControls = {
    $add: H5PEditor.$('<a href="#" aria-label="' + H5PEditor.t('H5PEditor.BookMaker', 'newScene') + '" class="h5p-scenecontrols-button h5p-scenecontrols-button-add"></a>'),
    $clone: H5PEditor.$('<a href="#" aria-label="' + H5PEditor.t('H5PEditor.BookMaker', 'cloneScene') + '" class="h5p-clone-scene h5p-scenecontrols-button h5p-scenecontrols-button-clone"></a>'),
    $background: H5PEditor.$('<a href="#" aria-label="' + H5PEditor.t('H5PEditor.BookMaker', 'backgroundScene') + '" class="h5p-scenecontrols-button h5p-scenecontrols-button-background"></a>'),
    $sortLeft: H5PEditor.$('<a href="#" aria-label="' + H5PEditor.t('H5PEditor.BookMaker', 'sortScene', {':dir': 'left'}) + '" class="h5p-scenecontrols-button h5p-scenecontrols-button-sort-left"></a>'),
    $sortRight: H5PEditor.$('<a href="#" aria-label="' + H5PEditor.t('H5PEditor.BookMaker', 'sortScene', {':dir': 'right'}) + '" class="h5p-scenecontrols-button h5p-scenecontrols-button-sort-right"></a>'),
    $delete: H5PEditor.$('<a href="#" aria-label="' + H5PEditor.t('H5PEditor.BookMaker', 'removeScene') + '" class="h5p-scenecontrols-button h5p-scenecontrols-button-delete"></a>')
  };
  this.sceneControls = sceneControls;

  H5PEditor.$('<div class="h5p-scenecontrols">').append([
    sceneControls.$add,
    sceneControls.$clone,
    sceneControls.$background,
    sceneControls.$sortLeft,
    sceneControls.$sortRight,
    sceneControls.$delete
  ]).appendTo(this.bookMaker.$wrapper)
    .children('a:first')
    .click(function () {
      that.addScene();
      return false;
    })
    .next()
    .click(function () {
      var newScene = H5P.cloneObject(that.params.scenes[that.bookMaker.$current.index()], true);
      that.addScene(newScene);
      return false;
    })
    .next()
    .click(function () {
      that.backgroundSelector.toggleOpen();
      H5PEditor.$(this).toggleClass('active');
      return false;
    })
    .next()
    .click(function () {
      that.sortScene(that.bookMaker.$current.prev(), -1);
      return false;
    })
    .next()
    .click(function () {
      that.sortScene(that.bookMaker.$current.next(), 1);
      return false;
    })
    .next()
    .click(function () {
      var removeIndex = that.bookMaker.$current.index();
      var removed = that.removeScene();
      if (removed !== false) {
        that.trigger('removeScene', removeIndex);
      }
      return false;
    });

  // Relay window resize to CP view
  H5P.$window.on('resize', function () {
    that.bookMaker.trigger('resize');
  });
};

/**
 * Add Drag and Drop button group.
 *
 * @param {H5P.Library} library Library for which a button will be added.
 * @param {object} options Options.
 */
H5PEditor.BookMaker.prototype.addDNBButton = function (library, options) {
  var that = this;
  options = options || {};
  var id = library.name.split('.')[1].toLowerCase();

  return {
    id: options.id || id,
    title: (options.title === undefined) ? library.title : options.title,
    createElement: function () {
      // Mind the functions's context
      return that.addElement(library.uberName, H5P.jQuery.extend(true, {}, options));
    }
  };
};

/**
 * Add Drag and Drop button group.
 *
 * @param {H5P.Library} library Library for which a button will be added.
 * @param {object} groupData Data for the group.
 * @return {object} Button group.
 */
H5PEditor.BookMaker.prototype.addDNBButtonGroup = function (library, groupData) {
  var that = this;
  var id = library.name.split('.')[1].toLowerCase();

  const buttonGroup = {
    id: id,
    title: groupData.dropdown.title || library.title,
    titleGroup: groupData.dropdown.titleGroup,
    type: 'group',
    buttons: []
  };

  // Add buttons to button group
  groupData.buttons.forEach(function (button) {
    const options = {
      id: button.id,
      title: button.title,
      width: button.width,
      height: button.height,
      action: {
        library: library.uberName,
        params: button.params || {}
      }
    };

    buttonGroup.buttons.push(that.addDNBButton(library, options));
  });

  return buttonGroup;
};

H5PEditor.BookMaker.prototype.setContainerEm = function (containerEm) {
  this.containerEm = containerEm;

  if (this.dnb !== undefined && this.dnb.dnr !== undefined) {
    this.dnb.dnr.setContainerEm(this.containerEm);
  }
};

/**
 * Initialize the drag and drop menu bar.
 *
 * @returns {undefined}
 */
H5PEditor.BookMaker.prototype.initializeDNB = function () {
  var that = this;

  this.$bar = H5PEditor.$('<div class="h5p-dragnbar">' + H5PEditor.t('H5PEditor.BookMaker', 'loading') + '</div>').insertBefore(this.bookMaker.$boxWrapper);
  const scenes = H5PEditor.BookMaker.findField('scenes', this.field.fields);
  var elementFields = H5PEditor.BookMaker.findField('elements', scenes.field.fields).field.fields;
  var action = H5PEditor.BookMaker.findField('action', elementFields);

  const shapeButtonBase = {
    title: '',
    width: 14.09, // 100 units
    height: 14.09
  };

  const shapeButtonBase1D = {
    params: {
      line: {
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#000'
      }
    }
  };

  const shapeButtonBase2D = {
    params: {
      shape: {
        fillColor: '#fff',
        borderWidth: 0,
        borderStyle: 'solid',
        borderColor: '#000',
      }
    }
  };

  // Ideally, this would not be built here
  const dropdownMenus = [];
  dropdownMenus['shape'] = {
    dropdown: {
      id: 'shape'
    },
    buttons: [
      H5P.jQuery.extend(true, {}, shapeButtonBase, shapeButtonBase2D, {
        id: 'shape-rectangle',
        params: {
          type: 'rectangle',
          shape: {
            borderRadius: 0
          }
        }
      }),
      H5P.jQuery.extend(true, {}, shapeButtonBase, shapeButtonBase2D, {
        id: 'shape-circle',
        params: {
          type: 'circle'
        }
      }),
      H5P.jQuery.extend(true, {}, shapeButtonBase, shapeButtonBase1D, {
        id: 'shape-horizontal-line',
        params: {
          type: 'horizontal-line'
        }
      }),
      H5P.jQuery.extend(true, {}, shapeButtonBase, shapeButtonBase1D, {
        id: 'shape-vertical-line',
        params: {
          type: 'vertical-line'
        }
      })
    ]
  };

  H5PEditor.LibraryListCache.getLibraries(action.options, function (libraries) {
    that.libraries = libraries;
    var buttons = [];
    for (var i = 0; i < libraries.length; i++) {
      if (libraries[i].restricted !== true) {
        // Insert button or buttongroup
        const libraryId = libraries[i].name.split('.')[1].toLowerCase();
        if (dropdownMenus[libraryId] === undefined) {
          buttons.push(that.addDNBButton(libraries[i]));
        }
        else {
          buttons.push(that.addDNBButtonGroup(libraries[i], dropdownMenus[libraryId]));
        }
      }
    }

    that.dnb = new H5P.DragNBar(buttons, that.bookMaker.$current, that.$editor, {$blurHandlers: that.bookMaker.$boxWrapper, libraries: libraries});

    that.$dnbContainer = that.bookMaker.$current;
    that.dnb.dnr.snap = 10;
    that.dnb.dnr.setContainerEm(that.containerEm);

    // Register all attached elements with dnb
    that.elements.forEach(function (scene, sceneIndex) {
      scene.forEach(function (element, elementIndex) {
        var elementParams = that.params.scenes[sceneIndex].elements[elementIndex];
        that.addToDragNBar(element, elementParams);
      });
    });

    // Resizing listener
    that.dnb.dnr.on('startResizing', function () {
    });

    // Resizing has stopped
    that.dnb.dnr.on('stoppedResizing', function () {
      var elementParams = that.params.scenes[that.bookMaker.$current.index()].elements[that.dnb.$element.index()];

      // Store new element position
      elementParams.width = that.dnb.$element.width() / (that.bookMaker.$current.innerWidth() / 100);
      elementParams.height = that.dnb.$element.height() / (that.bookMaker.$current.innerHeight() / 100);
      elementParams.y = ((parseFloat(that.dnb.$element.css('top')) / that.bookMaker.$current.innerHeight()) * 100);
      elementParams.x = ((parseFloat(that.dnb.$element.css('left')) / that.bookMaker.$current.innerWidth()) * 100);

      // Trigger element resize
      var elementInstance = that.bookMaker.elementInstances[that.bookMaker.$current.index()][that.dnb.$element.index()];
      H5P.trigger(elementInstance, 'resize');
    });

    // Update params when the element is dropped.
    that.dnb.stopMovingCallback = function (x, y) {
      var params = that.params.scenes[that.bookMaker.$current.index()].elements[that.dnb.$element.index()];

      params.x = (that.dnbMoves === 1 && that.dnbPositionOverride) ? that.dnbPositionOverride.x : x;
      params.y = (that.dnbMoves === 1 && that.dnbPositionOverride) ? that.dnbPositionOverride.y : y;

      that.dnbMoves = 0;
    };

    // Update params when the element is moved instead, to prevent timing issues.
    that.dnb.dnd.moveCallback = function (x, y) {
      var params = that.params.scenes[that.bookMaker.$current.index()].elements[that.dnb.$element.index()];
      params.x = x;
      params.y = y;

      that.dnbMoves = (!that.dnbMoves) ? 1 : that.dnbMoves + 1;

      that.dnb.updateCoordinates();
    };

    // Edit element when it is dropped.
    that.dnb.dnd.releaseCallback = function () {
      var params = that.params.scenes[that.bookMaker.$current.index()].elements[that.dnb.$element.index()];
      var element = that.elements[that.bookMaker.$current.index()][that.dnb.$element.index()];

      if (that.dnb.newElement) {
        that.bookMaker.$boxWrapper.add(that.bookMaker.$boxWrapper.find('.h5p-presentation-wrapper:first')).css('overflow', '');

        that.showElementForm(element, that.dnb.$element, params);
      }
    };

    /**
     * @private
     * @param {string} lib uber name
     * @returns {boolean}
     */
    that.supported = function (lib) {
      for (var i = 0; i < libraries.length; i++) {
        if (libraries[i].restricted !== true && libraries[i].uberName === lib) {
          return true; // Library is supported and allowed
        }
      }

      return false;
    };

    that.dnb.on('paste', function (event) {
      var pasted = event.data;
      var options = {
        width: pasted.width,
        height: pasted.height,
        pasted: true
      };

      if (pasted.from === H5PEditor.BookMaker.clipboardKey) {
        // Pasted content comes from the same version of CP

        if (!pasted.generic) {
          that.dnb.focus(that.addElement(pasted.specific, options));
        }
        else if (that.supported(pasted.generic.library)) {
          // Has generic part and the generic libray is supported
          that.dnb.focus(that.addElement(pasted.specific, options));
        }
        else {
          alert(H5PEditor.t('H5P.DragNBar', 'unableToPaste'));
        }
      }
      else if (pasted.generic) {
        if (that.supported(pasted.generic.library)) {
          // Supported library from another content type)
          options.action = pasted.generic;
          that.dnb.focus(that.addElement(pasted.generic.library, options));
        }
        else {
          alert(H5PEditor.t('H5P.DragNBar', 'unableToPaste'));
        }
      }
    });

    that.dnb.attach(that.$bar);

    // Set paste button
    that.dnb.setCanPaste(that.canPaste(H5P.getClipboard()));

    // Trigger event
    that.trigger('librariesReady');
  });
};

/**
 * Check if the clipboard can be pasted into CP.
 *
 * @param {Object} [clipboard] Clipboard data.
 * @return {boolean} True, if clipboard can be pasted.
 */
H5PEditor.BookMaker.prototype.canPaste = function (clipboard) {
  if (clipboard) {
    if (clipboard.from === H5PEditor.BookMaker.clipboardKey &&
        (!clipboard.generic || this.supported(clipboard.generic.library))) {
      // Content comes from the same version of CP
      return true;
    }
    else if (clipboard.generic && this.supported(clipboard.generic.library)) {
      // Supported library from another content type
      return true;
    }
  }

  return false;
};

/**
 * Create HTML for the field.
 */
H5PEditor.BookMaker.prototype.createHtml = function () {
  return H5PEditor.createFieldMarkup(this.field, '<div class="editor"></div>');
};

/**
 * Validate the current field.
 */
H5PEditor.BookMaker.prototype.validate = function () {
  // Validate all form elements
  var valid = true;

  for (var i = 0; i < this.elements.length; i++) {
    if (!this.elements[i]) {
      continue;
    }
    for (var j = 0; j < this.elements[i].length; j++) {
      // Validate element form
      for (var k = 0; k < this.elements[i][j].children.length; k++) {
        if (this.elements[i][j].children[k].validate() === false && valid) {
          valid = false;
        }
      }
    }
  }
  valid &= this.backgroundSelector.validate();

  this.trigger('validate');
  return valid;
};

/**
 * Remove this item.
 */
H5PEditor.BookMaker.prototype.remove = function () {
  this.trigger('remove');
  if (this.dnb !== undefined) {
    this.dnb.remove();
  }
  this.$item.remove();

  this.elements.forEach(function (scenes) {
    scenes.forEach(function (interaction) {
      H5PEditor.removeChildren(interaction.children);
    });
  });
};

/**
 * Adds scene after current scene.
 *
 * @param {object} sceneParams
 * @returns {undefined} Nothing
 */
H5PEditor.BookMaker.prototype.addScene = function (sceneParams) {
  var that = this;

  if (sceneParams === undefined) {
    // Set new scene params
    sceneParams = {
      elements: []
    };
  }

  var index = this.bookMaker.$current.index() + 1;
  this.params.scenes.splice(index, 0, sceneParams);
  this.elements.splice(index, 0, []);
  this.bookMaker.elementInstances.splice(index, 0, []);
  this.bookMaker.elementsAttached.splice(index, 0, []);
  const scene = this.bookMaker.addChild(sceneParams, index);

  // Add scene with elements
  scene.getElement().insertAfter(this.bookMaker.$current);
  that.trigger('addedScene', index);
  scene.appendElements();

  // Update progressbar
  this.updateNavigationLine(index);

  // Switch to the new scene
  this.bookMaker.nextScene();
};

H5PEditor.BookMaker.prototype.updateNavigationLine = function (index) {
  // Update progressbar and footer
  this.bookMaker.navigationLine.initProgressbar();
  this.bookMaker.navigationLine.updateProgressBar(index);
  this.bookMaker.navigationLine.updateFooter(index);
};

/**
 * Remove the current scene
 *
 * @returns {Boolean} Indicates success
 */
H5PEditor.BookMaker.prototype.removeScene = function () {
  var index = this.bookMaker.$current.index();
  var isRemovingDnbContainer = this.bookMaker.$current.index() === this.$dnbContainer.index();

  // Confirm
  if (!confirm(H5PEditor.t('H5PEditor.BookMaker', 'confirmDeleteScene'))) {
    return false;
  }

  // Remove elements from scene
  var sceneKids = this.elements[index];
  if (sceneKids !== undefined) {
    for (var i = 0; i < sceneKids.length; i++) {
      this.removeElement(sceneKids[i], sceneKids[i].$wrapper);
    }
  }
  this.elements.splice(index, 1);

  // Change scene
  var move = this.bookMaker.previousScene() ? -1 : (this.bookMaker.nextScene(true) ? 0 : undefined);

  // Replace existing DnB container used for calculating dimensions of elements
  if (isRemovingDnbContainer) {
    // Set new dnb container
    this.$dnbContainer = this.bookMaker.$current;
    this.dnb.setContainer(this.$dnbContainer);
  }
  if (move === undefined) {
    return false; // No next or previous scene
  }

  // Update presentation params.
  this.params.scenes.splice(index, 1);

  // Update the list of element instances
  this.bookMaker.elementInstances.splice(index, 1);
  this.bookMaker.elementsAttached.splice(index, 1);

  this.bookMaker.removeChild(index);

  this.updateNavigationLine(index + move);
};

/**
 * Animate navigation line scene icons when the scenes are sorted
 *
 * @param {number} direction 1 for next, -1 for prev.
 */
H5PEditor.BookMaker.prototype.animateNavigationLine = function (direction) {
  var that = this;

  var $selectedProgressPart = that.bookMaker.$progressbar.find('.h5p-progressbar-part-selected');
  $selectedProgressPart.css('transform', 'translateX(' + (-100 * direction) + '%)');

  var $selectedNext = (direction === 1 ? $selectedProgressPart.prev() : $selectedProgressPart.next());
  $selectedNext.css('transform', 'translateX(' + (100 * direction) + '%)');

  setTimeout(function () { // Next tick triggers animation
    $selectedProgressPart.add($selectedNext).css('transform', '');
  }, 0);
};

/**
 * Sort current scene in the given direction.
 *
 * @param {H5PEditor.$} $element The next/prev scene.
 * @param {int} direction 1 for next, -1 for prev.
 * @returns {Boolean} Indicates success.
 */
H5PEditor.BookMaker.prototype.sortScene = function ($element, direction) {
  if (!$element.length) {
    return false;
  }

  var index = this.bookMaker.$current.index();

  // Move scenes
  if (direction === -1) {
    this.bookMaker.$current.insertBefore($element.removeClass('h5p-previous'));
  }
  else {
    this.bookMaker.$current.insertAfter($element.addClass('h5p-previous'));
  }

  // Jump to sorted scene number
  var newIndex = index + direction;
  this.bookMaker.jumpToScene(newIndex);

  // Update params.
  this.swapCollectionIndex(this.params.scenes, index, newIndex);
  this.swapCollectionIndex(this.elements, index, newIndex);
  this.swapCollectionIndex(this.bookMaker.elementInstances, index, newIndex);
  this.swapCollectionIndex(this.bookMaker.elementsAttached, index, newIndex);
  this.bookMaker.moveChild(index, newIndex);

  this.updateNavigationLine(newIndex);

  this.animateNavigationLine(direction);
  this.trigger('sortScene', direction);

  return true;
};

/**
 * Swap indexes in array, useful when sorting
 *
 * @param {Array} collection The collection we'll swap indexes in
 * @param {number} firstIndex First index that will be swapped
 * @param {number} secondIndex Second index that will be swapped
 */
H5PEditor.BookMaker.prototype.swapCollectionIndex = function (collection, firstIndex, secondIndex) {
  var temp = collection[firstIndex];
  collection[firstIndex] = collection[secondIndex];
  collection[secondIndex] = temp;
};

/**
 * Swaps the [data-index] values of two elements
 *
 * @param {jQuery} $current
 * @param {jQuery} $other
 */
H5PEditor.BookMaker.prototype.swapIndexes = function ($current, $other) {
  var currentIndex = $current.attr('data-index');
  var otherIndex = $other.attr('data-index');
  $current.attr('data-index', otherIndex);
  $other.attr('data-index', currentIndex);
};

/**
 * Generate element form.
 *
 * @param {Object} elementParams
 * @param {String} type
 * @returns {Object}
 */
H5PEditor.BookMaker.prototype.generateForm = function (elementParams, type) {
  var self = this;

  // Get semantics for the elements field
  const scenes = H5PEditor.BookMaker.findField('scenes', this.field.fields);
  var elementFields = H5PEditor.$.extend(true, [], H5PEditor.BookMaker.findField('elements', scenes.field.fields).field.fields);

  // Manipulate semantics into only using a given set of fields
  var hideFields = ['title'];

  if (type === 'H5P.AdvancedText') {
    hideFields.push('customImagePlay');
    hideFields.push('customImagePlayPaused');
    hideFields.push('customImagePause');
    hideFields.push('canBeMovedByUser');
    hideFields.push('displayAsButton');
    hideFields.push('audio');
  }

  if (type === 'H5P.Image') {
    hideFields.push('customImagePlay');
    hideFields.push('customImagePlayPaused');
    hideFields.push('customImagePause');
    hideFields.push('canBeChangedByUser');
    hideFields.push('displayAsButton');
  }

  if (type === 'H5P.Audio') {
    hideFields.push('backgroundOpacity');
    hideFields.push('canBeMovedByUser');
    hideFields.push('displayAsButton');
    hideFields.push('audio');
  }

  if (type === 'H5P.Shape') {
    hideFields.push('customImagePlay');
    hideFields.push('customImagePlayPaused');
    hideFields.push('customImagePause');
    hideFields.push('backgroundOpacity');
    hideFields.push('canBeMovedByUser');
    hideFields.push('canBeChangedByUser');
    hideFields.push('displayAsButton');
    hideFields.push('audio');
  }

  // Only display goToScene field for goToScene elements
  self.hideFields(elementFields, hideFields);

  var element = {
    '$form': H5P.jQuery('<div/>')
  };

  // Render element fields
  H5PEditor.processSemanticsChunk(elementFields, elementParams, element.$form, self);
  element.children = self.children;

  /*
   * For the audio chooser, the H5P editor for Audio uses an overlay with
   * position:absolute, so the editor form will not resize when the the audio
   * chooser is opened. Without being able to change the core (without
   * forking), here this workaround resizes the form as required.
   */

  /**
   * Resize audio Dialog
   *
   * @param {H5PEditor.Group} audioGroup Editor group for audio options.
   * @param {H5PEditor.AV} [audio] Audio element to consider for size, reset if undefined.
   */
  const resizeAudioDialog = function (audioGroup, audio) {
    if (!audio) {
      audioGroup.$content.css('height', '');
    }
    else {
      const originalHeight = audioGroup.$content.height();
      const requiredHeight = audio.$addDialog.parent().position().top + audio.$addDialog.outerHeight();

      audioGroup.$content.css('height', Math.max(originalHeight, requiredHeight));
    }
  };

  element.children.forEach(function (child) {
    if (child.field.name === 'audio') {
      const audioGroup = child;

      if (!child.children) {
        return;
      }

      child.children.forEach(function (child) {
        if (!child.field || !child.field.type === 'audio') {
          return; // Skip if not an audio editor element.
        }

        // Loading existing content with audio and thumbnail
        if (child.$files.find('.h5p-thumbnail').length > 0) {
          child.$files.find('.h5p-thumbnail').get(0).addEventListener('click', function () {
            resizeAudioDialog(audioGroup, child);
          });
        }

        // Adding new audio
        child.$add.get(0).addEventListener('click', function () {
          resizeAudioDialog(audioGroup, child);
        });

        // Cancelling audio dialog
        child.$addDialog.find('.h5p-cancel').get(0).addEventListener('click', function () {
          resizeAudioDialog(audioGroup);
        });

        // New audio uploading
        child.on('uploadProgress', function () {
          resizeAudioDialog(audioGroup);
        });

        // New audio uploaded
        child.on('uploadComplete', function () {
          // New thumbnail was created
          child.$files.find('.h5p-thumbnail').get(0).addEventListener('click', function () {
            resizeAudioDialog(audioGroup, child);
          });
        });
      });
    }
  });

  // Remove library selector and copy button and paste button
  var pos = elementFields.map(function (field) {
    return field.type;
  }).indexOf('library');
  if (pos !== -1 && element.children[pos].hide) {
    element.children[pos].hide();
    element.$form.css('padding-top', '0');
  }

  // Set correct aspect ratio on new images.
  // TODO: Do not use/rely on magic numbers!
  var library = element.children[4];
  if (!(library instanceof H5PEditor.None)) {
    var libraryChange = function () {
      if (library.children[0].field.type === 'image') {
        library.children[0].changes.push(function (params) {
          self.setImageSize(element, elementParams, params);
        });
      }
      else if (library.children[0].field.type === 'video') {
        library.children[0].changes.push(function (params) {
          self.setVideoSize(elementParams, params);
        });
      }

      // Determine library options for this subcontent library
      var libraryOptions = H5PEditor.BookMaker.findField('action', elementFields).options;
      if (libraryOptions.length > 0 && typeof libraryOptions[0] === 'object') {
        libraryOptions = libraryOptions.filter(function (option) {
          return option.name.split(' ')[0] === type;
        });
        libraryOptions = (libraryOptions.length > 0) ? libraryOptions[0] : {};
      }
      else {
        libraryOptions = {};
      }
    };
    if (library.children === undefined) {
      library.changes.push(libraryChange);
    }
    else {
      libraryChange();
    }
  }

  return element;
};

/**
 * Help set size for new images and keep aspect ratio.
 *
 * @param {object} element
 * @param {object} elementParams
 * @param {object} fileParams
 */
H5PEditor.BookMaker.prototype.setImageSize = function (element, elementParams, fileParams) {
  if (fileParams === undefined || fileParams.width === undefined || fileParams.height === undefined) {
    return;
  }

  // Avoid to small images
  var minSize = parseInt(element.$wrapper.css('font-size')) +
                element.$wrapper.outerHeight() -
                element.$wrapper.innerHeight();

  // Use minSize
  if (fileParams.width < minSize) {
    fileParams.width = minSize;
  }
  if (fileParams.height < minSize) {
    fileParams.height = minSize;
  }

  // Reduce height for tiny images, stretched pixels looks horrible
  var suggestedHeight = fileParams.height / (this.bookMaker.$current.innerHeight() / 100);
  if (suggestedHeight < elementParams.height) {
    elementParams.height = suggestedHeight;
  }

  // Calculate new width
  elementParams.width = (elementParams.height * (fileParams.width / fileParams.height)) / this.sceneRatio;
};

/**
 * Help set size for new videos and keep aspect ratio.
 *
 * @param {object} element
 * @param {object} elementParams
 * @param {object} fileParams
 */
H5PEditor.BookMaker.prototype.setVideoSize = function (elementParams, fileParams) {
  if (fileParams === undefined) {
    return;
  }
  if (fileParams.hasOwnProperty('aspectRatio') !== true) {
    fileParams.aspectRatio = '16:9';
  }

  const ratioParts = String(fileParams.aspectRatio).split(':');
  elementParams.height = (elementParams.width * (ratioParts.length === 1 ? fileParams.aspectRatio : (ratioParts[1] / ratioParts[0]))) * this.sceneRatio;
};

/**
 * Hide all fields in the given list. All others are shown.
 *
 * @param {Object[]} elementFields
 * @param {String[]} fields
 */
H5PEditor.BookMaker.prototype.hideFields = function (elementFields, fields) {
  // Find and hide fields in list
  for (var i = 0; i < fields.length; i++) {
    var field = H5PEditor.BookMaker.findField(fields[i], elementFields);
    if (field) {
      field.widget = 'none';
    }
  }
};

/**
 * Show all fields in the given list. All others are hidden.
 *
 * @param {Object[]} elementFields
 * @param {String[]} fields
 */
H5PEditor.BookMaker.prototype.showFields = function (elementFields, fields) {
  // Find and hide all fields not in list
  for (var i = 0; i < elementFields.length; i++) {
    var field = elementFields[i];
    var found = false;

    for (var j = 0; j < fields.length; j++) {
      if (field.name === fields[j]) {
        found = true;
        break;
      }
    }

    if (!found) {
      field.widget = 'none';
    }
  }
};

/**
* Find the title for the given library.
*
* @param {String} type Library name
* @param {Function} next Called when we've found the title
*/
H5PEditor.BookMaker.prototype.findLibraryTitle = function (library, next) {
  var self = this;

  /** @private */
  var find = function () {
    for (var i = 0; i < self.libraries.length; i++) {
      if (self.libraries[i].name === library) {
        next(self.libraries[i].title);
        return;
      }
    }
  };

  if (self.libraries === undefined) {
    // Must wait until library titles are loaded
    self.once('librariesReady', find);
  }
  else {
    find();
  }
};

/**
 * Callback used by CP when a new element is added.
 *
 * @param {Object} elementParams
 * @param {jQuery} $wrapper
 * @param {Number} sceneIndex
 * @param {Object} elementInstance
 * @returns {undefined}
 */
H5PEditor.BookMaker.prototype.processElement = function (elementParams, $wrapper, sceneIndex, elementInstance) {
  var that = this;

  // Detect type
  var type;
  if (elementParams.action !== undefined) {
    type = elementParams.action.library.split(' ')[0];
  }
  else {
    type = 'unknown';
  }

  // Find element identifier
  var elementIndex = $wrapper.index();

  // Generate element form
  if (this.elements[sceneIndex] === undefined) {
    this.elements[sceneIndex] = [];
  }
  if (this.elements[sceneIndex][elementIndex] === undefined) {
    this.elements[sceneIndex][elementIndex] = this.generateForm(elementParams, type);
  }

  // Get element
  var element = this.elements[sceneIndex][elementIndex];
  element.$wrapper = $wrapper;

  H5P.jQuery('<div/>', {
    'class': 'h5p-element-overlay'
  }).appendTo($wrapper);

  if (that.dnb) {
    that.addToDragNBar(element, elementParams);
  }

  // Open form dialog when double clicking element
  $wrapper.dblclick(function () {
    that.showElementForm(element, $wrapper, elementParams);
  });

  if (elementParams.pasted) {
    delete elementParams.pasted;
  }

  if (elementInstance.onAdd) {
    // Some sort of callback event thing
    elementInstance.onAdd(elementParams, sceneIndex);
  }
};

/**
 * Make sure element can be moved and stop moving while resizing.
 *
 * @param {Object} element
 * @param {Object} elementParams
 * @returns {H5P.DragNBarElement}
 */
H5PEditor.BookMaker.prototype.addToDragNBar = function (element, elementParams) {
  var self = this;

  var type = (elementParams.action ? elementParams.action.library.split(' ')[0] : null);

  const options = {
    lock: (type === 'H5P.Chart' && elementParams.action.params.graphMode === 'pieChart'),
    cornerLock: (type === 'H5P.Image' || type === 'H5P.Shape')
  };

  if (type === 'H5P.Shape') {
    options.minSize = 3;
    if (elementParams.action.params.type === 'vertical-line') {
      options.directionLock = "vertical";
    }
    else if (elementParams.action.params.type === 'horizontal-line') {
      options.directionLock = "horizontal";
    }
  }

  var clipboardData = H5P.DragNBar.clipboardify(H5PEditor.BookMaker.clipboardKey, elementParams, 'action');
  var dnbElement = self.dnb.add(element.$wrapper, clipboardData, options);
  dnbElement.contextMenu.on('contextMenuEdit', function () {
    self.showElementForm(element, element.$wrapper, elementParams);
  });
  element.$wrapper.find('*').attr('tabindex', '-1');

  dnbElement.contextMenu.on('contextMenuRemove', function () {
    if (!confirm(H5PEditor.t('H5PEditor.BookMaker', 'confirmRemoveElement'))) {
      return;
    }
    if (H5PEditor.Html) {
      H5PEditor.Html.removeWysiwyg();
    }
    self.removeElement(element, element.$wrapper);
    self.dnb.blurAll();
  });

  dnbElement.contextMenu.on('contextMenuBringToFront', function () {
    // Old index
    var oldZ = element.$wrapper.index();

    // Current scene index
    var sceneIndex = self.bookMaker.$current.index();

    // Update visuals
    element.$wrapper.appendTo(self.bookMaker.$current);

    // Find scene params
    const scene = self.params.scenes[sceneIndex].elements;

    // Remove from old pos
    scene.splice(oldZ, 1);

    // Add to top
    scene.push(elementParams);

    // Re-order elements in the same fashion
    self.elements[sceneIndex].splice(oldZ, 1);
    self.elements[sceneIndex].push(element);

    self.bookMaker.children[sceneIndex].moveChild(oldZ, self.bookMaker.children[sceneIndex].children.length - 1);
  });

  dnbElement.contextMenu.on('contextMenuSendToBack', function () {
    // Old index
    var oldZ = element.$wrapper.index();

    // Current scene index
    var sceneIndex = self.bookMaker.$current.index();

    // Update visuals
    element.$wrapper.prependTo(self.bookMaker.$current);

    // Find scene params
    const scene = self.params.scenes[sceneIndex].elements;

    // Remove from old pos
    scene.splice(oldZ, 1);

    // Add to top
    scene.unshift(elementParams);

    // Re-order elements in the same fashion
    self.elements[sceneIndex].splice(oldZ, 1);
    self.elements[sceneIndex].unshift(element);

    self.bookMaker.children[sceneIndex].moveChild(oldZ, 0);
  });

  return dnbElement;
};

/**
 * Removes element from scene.
 *
 * @param {Object} element
 * @param {jQuery} $wrapper
 * @returns {undefined}
 */
H5PEditor.BookMaker.prototype.removeElement = function (element, $wrapper) {
  var sceneIndex = this.bookMaker.$current.index();
  var elementIndex = $wrapper.index();

  var elementInstance = this.bookMaker.elementInstances[sceneIndex][elementIndex];
  var removeForm = (element.children.length ? true : false);

  if (removeForm) {
    H5PEditor.removeChildren(element.children);
  }

  // Completely remove element from CP
  if (elementInstance.onDelete) {
    elementInstance.onDelete(this.params, sceneIndex, elementIndex);
  }
  this.elements[sceneIndex].splice(elementIndex, 1);
  this.bookMaker.elementInstances[sceneIndex].splice(elementIndex, 1);
  this.params.scenes[sceneIndex].elements.splice(elementIndex, 1);
  this.bookMaker.children[sceneIndex].removeChild(elementIndex);

  $wrapper.remove();
};

/**
 * Displays the given form in a popup.
 *
 * @param {jQuery} $form
 * @param {jQuery} $wrapper
 * @param {object} element Params
 * @returns {undefined}
 */
H5PEditor.BookMaker.prototype.showElementForm = function (element, $wrapper, elementParams) {
  var that = this;

  /**
   * The user has clicked delete, remove the element.
   * @private
   */
  const handleFormremove = function (e) {
    e.preventRemove = !confirm(H5PEditor.t('H5PEditor.BookMaker', 'confirmRemoveElement'));
    if (e.preventRemove) {
      return;
    }
    that.removeElement(element, $wrapper);
    that.dnb.blurAll();
    that.dnb.preventPaste = false;
  };
  that.on('formremove', handleFormremove);

  /**
   * The user is done editing, save and update the display.
   * @private
   */
  const handleFormdone = function () {
    // Validate / save children
    for (var i = 0; i < element.children.length; i++) {
      element.children[i].validate();
    }

    // Adjust size for custom audio button image
    if (
      elementParams.action && typeof elementParams.action.library === 'string' && elementParams.action.library.split(' ')[0] === 'H5P.Audio' &&
      elementParams.customImagePlay && elementParams.customImagePlay.width && elementParams.customImagePlay.height
    ) {
      if (elementParams.customImagePlay.width > elementParams.customImagePlay.height) {
        elementParams.width = elementParams.height / elementParams.customImagePlay.height * elementParams.customImagePlay.width / that.sceneRatio;
      }
      else {
        elementParams.height = elementParams.width / elementParams.customImagePlay.width * elementParams.customImagePlay.height * that.sceneRatio;
      }
    }

    that.redrawElement($wrapper, element, elementParams);

    that.dnb.preventPaste = false;
  };
  that.on('formdone', handleFormdone);

  /**
   * The form pane is fully displayed.
   * @private
   */
  const handleFormopened = function () {
    if (isLoaded) {
      focusFirstField();
    }
  };
  that.on('formopened', handleFormopened);

  /**
   * Remove event listeners on form close
   * @private
   */
  const handleFormclose = function () {
    that.off('formremove', handleFormremove);
    that.off('formdone', handleFormdone);
    that.off('formclose', handleFormclose);
    that.off('formopened', handleFormopened);
  };
  that.on('formclose', handleFormclose);

  const libraryField = H5PEditor.findField('action', element);

  /**
   * Focus the first field of the form.
   * Should be triggered when library is loaded + form is opened.
   *
   * @private
   */
  var focusFirstField = function () {
    // Find the first ckeditor or texteditor field that is not hidden.
    // h5p-editor dialog is copyright dialog
    // h5p-dialog-box is IVs video choose dialog
    H5P.jQuery('.ckeditor, .h5peditor-text', libraryField.$myField)
      .not('.h5p-editor-dialog .ckeditor, ' +
      '.h5p-editor-dialog .h5peditor-text, ' +
      '.h5p-dialog-box .ckeditor, ' +
      '.h5p-dialog-box .h5peditor-text', libraryField.$myField)
      .eq(0)
      .focus();
  };

  // Determine if library is already loaded
  let isLoaded = false;
  if (libraryField.currentLibrary === undefined && libraryField.change !== undefined) {
    libraryField.change(function () {
      isLoaded = true;
      if (that.isFormOpen()) {
        focusFirstField();
      }
    });
  }
  else {
    isLoaded = true;
  }

  let customTitle, customIconId;

  // Open a new form pane with the element form
  that.openForm(libraryField, element.$form[0], null, customTitle, customIconId);

  // Deselect any elements
  if (that.dnb !== undefined) {
    that.dnb.preventPaste = true;
    setTimeout(function () {
      that.dnb.blurAll();
    }, 0);
  }
};

/**
* Redraw element.
*
* @param {jQuery} $wrapper Element container to be redrawn.
* @param {object} element Element data.
* @param {object} elementParams Element parameters.
* @param {number} [repeat] Counter for redrawing if necessary.
*/
H5PEditor.BookMaker.prototype.redrawElement = function ($wrapper, element, elementParams, repeat) {
  var elementIndex = $wrapper.index();
  var sceneIndex = this.bookMaker.$current.index();
  var elementsParams = this.params.scenes[sceneIndex].elements;
  var elements = this.elements[sceneIndex];
  var elementInstances = this.bookMaker.elementInstances[sceneIndex];

  // Determine how many elements still need redrawal after this one
  repeat = (typeof repeat === 'undefined') ? elements.length - 1 - elementIndex : repeat;

  // Remove Element instance from Scene
  this.bookMaker.children[sceneIndex].removeChild(elementIndex);

  // Remove instance of lib:
  elementInstances.splice(elementIndex, 1);

  // Update params
  elementsParams.splice(elementIndex, 1);
  elementsParams.push(elementParams);

  // Update elements
  elements.splice(elementIndex, 1);
  elements.push(element);

  // Update visuals
  $wrapper.remove();
  var instance = this.bookMaker.children[sceneIndex].addChild(elementParams).instance;
  var $element = this.bookMaker.attachElement(elementParams, instance, this.bookMaker.$current, sceneIndex);

  // Make sure we're inside the container
  this.fitElement($element, elementParams);

  // Resize element.
  instance = elementInstances[elementInstances.length - 1];
  if ((instance.preventResize === undefined || instance.preventResize === false) && instance.$ !== undefined) {
    H5P.trigger(instance, 'resize');
  }

  var that = this;
  if (repeat === elements.length - 1 - elementIndex) {
    setTimeout(function () {
      // Put focus back on element
      that.dnb.focus($element);
    }, 1);
  }

  /*
   * Reset to previous element order, otherwise the initially redrawn element
   * would be put on top instead of remaining at the original z position.
   */
  if (repeat > 0) {
    repeat--;
    this.redrawElement(elements[elementIndex].$wrapper, elements[elementIndex], elementsParams[elementIndex], repeat);
  }
};

/**
 * Applies the updated position and size properties to the given element.
 *
 * All properties are converted to percentage.
 *
 * @param {H5P.jQuery} $element
 * @param {Object} elementParams
 */
H5PEditor.BookMaker.prototype.fitElement = function ($element, elementParams) {
  var self = this;

  var sizeNPosition = self.dnb.getElementSizeNPosition($element);
  var updated = H5P.DragNBar.fitElementInside(sizeNPosition);

  var pW = (sizeNPosition.containerWidth / 100);
  var pH = (sizeNPosition.containerHeight / 100);

  // Set the updated properties
  var style = {};

  if (updated.width !== undefined) {
    elementParams.width = updated.width / pW;
    style.width = elementParams.width + '%';
  }
  if (updated.left !== undefined) {
    elementParams.x = updated.left / pW;
    style.left = elementParams.x + '%';
  }
  if (updated.height !== undefined) {
    elementParams.height = updated.height / pH;
    style.height = elementParams.height + '%';
  }
  if (updated.top !== undefined) {
    elementParams.y = updated.top / pH;
    style.top = elementParams.y + '%';
  }

  // Apply style
  $element.css(style);
};

/**
 * Collect functions to execute once the tree is complete.
 *
 * @param {function} ready
 * @returns {undefined}
 */
H5PEditor.BookMaker.prototype.ready = function (ready) {
  if (this.passReadies) {
    this.parent.ready(ready);
  }
  else {
    this.readies.push(ready);
  }
};

/**
 * Look for field with the given name in the given collection.
 *
 * @param {String} name of field
 * @param {Array} fields collection to look in
 * @returns {Object} field object
 */
H5PEditor.BookMaker.findField = function (name, fields) {
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].name === name) {
      return fields[i];
    }
  }
};

/** @constant {Number} */
H5PEditor.BookMaker.RATIO_SURFACE = 16 / 9;


// Tell the editor what widget we are.
H5PEditor.widgets.bookmaker = H5PEditor.BookMaker;
