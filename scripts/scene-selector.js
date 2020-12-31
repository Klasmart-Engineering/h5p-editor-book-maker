H5PEditor.BookMaker.SceneSelector = (function ($, EventDispatcher) {

  /**
   * Create a Scene Selector with background settings
   *
   * @class H5PEditor.BookMaker.SceneSelector
   * @extends H5P.EventDispatcher Enables pub/sub
   * @param {H5PEditor.BookMaker} bookMakerEditor CP editor for listening to events
   * @param {jQuery} $scenes Targeted scenes
   * @param {Object} globalFields Global semantic fields
   * @param {Object} sceneFields Single scene semantic fields
   * @param {Object} params Parameters for semantic fields
   */
  function SceneSelector(bookMakerEditor, $scenes, globalFields, sceneFields, params) {
    var self = this;

    // Inheritance
    EventDispatcher.call(self);

    // Background selector open state
    var isOpen = false;

    // Keep track of single scenes
    var singleScenes = [];

    // Keep track of the global background selector
    var globalBackground;

    // Keep track of current scene
    var currentScene = 0;

    // DOM elements
    var $popup = $('<div class="h5p-background-selector">');
    var $title = $('<div class="h5p-background-selector-title">')
      .html(H5PEditor.t('H5PEditor.BookMaker', 'sceneBackground', {}))
      .appendTo($popup);
    $('<div>', {
      class: 'h5p-background-selector-close',
      role: 'button',
      tabIndex: '0',
      click: function () {
        bookMakerEditor.sceneControls.$background.click();
      },
      keydown: function (e) {
        if (e.which === 32) {
          $(this).click();
          e.preventDefault();
        }
      }
    }).prependTo($title);
    var $header = $('<div>').appendTo($popup);
    var $contentWrapper = $('<div class="h5p-background-selector-content-wrapper">').appendTo($popup);
    var $globalContent;
    var $sceneContent;

    // Single scene semantic fields
    var singleSceneFields = H5PEditor.BookMaker.findField('sceneBackgroundSelector', sceneFields.field.fields);

    /**
     * Init background selectors
     * @private
     */
    var initBgSelectors = function () {

      // Global bg selector
      var templateString = H5PEditor.t('H5PEditor.BookMaker', 'template');
      var currentSceneString = H5PEditor.t('H5PEditor.BookMaker', 'currentScene');
      $globalContent = createSceneselector(templateString, true);
      globalBackground = new H5PEditor.BookMaker.BackgroundSelector($scenes.children())
        .addBgSelector(globalFields, params, $globalContent, {isVisible: true})
        .setDescription(H5PEditor.t('H5PEditor.BookMaker', 'templateDescription', {':currentScene': currentSceneString}))
        .addResetButton();

      // Single scene bg selector
      $sceneContent = createSceneselector(currentSceneString, false);
      $scenes.children().each(function (idx) {
        initSingleScene($sceneContent, idx)
          .setDescription(H5PEditor.t('H5PEditor.BookMaker', 'currentSceneDescription', {':template': templateString}))
          .addResetButton(H5PEditor.t('H5PEditor.BookMaker', 'resetToTemplate'));
      });

      // Select single scene if first scene has single scene options
      if (singleScenes[0].getSettings()) {
        changeSceneType($sceneContent);
      }

      // Resize header items
      $header.children().css('width', (100 / $header.children().length) + '%');
    };

    /**
     * Init listeners for scene operations
     * @private
     */
    var initSceneOperationsListeners = function () {
      // Register changed scene listener
      bookMakerEditor.bookMaker.on('changedScene', function (e) {
        if (currentScene !== e.data) {
          changeToScene(e.data);
        }
      });

      bookMakerEditor.on('sortScene', function (e) {
        sortScene(e.data);
      });

      bookMakerEditor.on('removeScene', function (e) {
        removeScene(e.data);
      });
      bookMakerEditor.on('addedScene', function (e) {
        addScene(e.data);
      });
    };

    /**
     * Sanitize parameters of scene index, so they can be easily processed
     *
     * @private
     * @param {number} idx Index of scene parameters
     */
    var sanitizeSceneParams = function (idx) {
      var sceneParams =  params.scenes[idx].sceneBackgroundSelector;
      if (!sceneParams) {
        return;
      }

      if (sceneParams.fill && !sceneParams.fill.length) {
        sceneParams.fill = undefined;
      }

      if (sceneParams.image && !sceneParams.image.path) {
        sceneParams.image = undefined;
      }
    };

    /**
     * Add scene selector at specified index
     *
     * @private
     * @param {number} newSceneIndex Index for new scene
     */
    var addScene = function (newSceneIndex) {
      // Must sanitize params before processing semantics
      sanitizeSceneParams(newSceneIndex);
      initSingleScene($sceneContent, newSceneIndex)
        .setDescription(H5PEditor.t('H5PEditor.BookMaker', 'currentSceneDescription', {
          ':template': H5PEditor.t('H5PEditor.BookMaker', 'template')
        }))
        .addResetButton(H5PEditor.t('H5PEditor.BookMaker', 'resetToTemplate'));

      // Change to selected radio button
      var selectedIndex = singleScenes[newSceneIndex - 1].getSelectedIndex();
      singleScenes[newSceneIndex].setSelectedIndex(selectedIndex);
    };

    /**
     * Remove scene selector at specified index
     *
     * @private
     * @param {number} removeIndex Index of removed scene
     */
    var removeScene = function (removeIndex) {
      var removed = singleScenes.splice(removeIndex, 1);
      removed.forEach(function (singleScene) {
        singleScene.removeElement();
      });
    };

    /**
     * Sort current scene selector to the specified direction
     *
     * @private
     * @param {number} dir Negative or positive direction and value of sort.
     */
    var sortScene = function (dir) {
      // Validate sort
      if ((currentScene + dir >= 0) && (currentScene + dir < $scenes.children().length)) {

        // Sort single scene settings in direction
        var temp = singleScenes[currentScene + dir];
        singleScenes[currentScene + dir] = singleScenes[currentScene];
        singleScenes[currentScene] = temp;

        // Swap elements
        var prev = currentScene + (dir < 0 ? 0 : dir);
        var next = currentScene + (dir < 0 ? dir : 0);
        $sceneContent.children().eq(prev)
          .insertBefore($sceneContent.children().eq(next));

        // Must update internal current scene, since CPs is transition based
        currentScene += dir;
      }
    };

    /**
     * Initialize a single scene
     *
     * @private
     * @param {jQuery} $wrapper Element the single scene will be attached to
     * @param {number} idx Index single scene will be inserted at
     * @returns {H5PEditor.BookMaker.BackgroundSelector} Background selector that was created
     */
    var initSingleScene = function ($wrapper, idx) {
      var sceneParams = params.scenes[idx];

      var singleScene = new H5PEditor.BookMaker.BackgroundSelector($scenes.children().eq(idx), true);

      // Trigger fallback to global background when single scene is removed
      globalBackground.setBackgroundScenes($scenes.children());
      singleScene.on('turnedGlobal', function () {
        globalBackground.addBackground();
      });

      // Create background selector
      singleScene.addBgSelector(singleSceneFields, sceneParams, $wrapper, {
        isSingle: true,
        isVisible: (idx === 0),
        index: idx
      });

      singleScenes.splice(idx, 0, singleScene);
      return singleScene;
    };

    /**
     * Change to specified scene
     *
     * @private
     * @param {number} index Index of scene we will change to
     */
    var changeToScene = function (index) {
      // Scene has not been created yet
      if (index >= singleScenes.length) {
        return;
      }

      // Show new scene if we changed scene
      $sceneContent.children().removeClass('show');
      $sceneContent.children().eq(index).addClass('show');

      // Show scene specific options
      var $changeToScene = singleScenes[index].getSettings() ? $sceneContent : $globalContent;
      changeSceneType($changeToScene);

      // Show new scene bg selector
      currentScene = index;
      updateColorPicker();
    };

    /**
     * Change scene type
     *
     * @private
     * @param {jQuery} $content The element that we will show
     */
    var changeSceneType = function ($content) {
      var $headerButton = $header.children().eq($content.index());
      if ($content.hasClass('show') && $headerButton.hasClass('active')) {
        return;
      }

      // Show new content
      $contentWrapper.children().removeClass('show');
      $content.addClass('show');

      // Set button as active
      $header.children().removeClass('active').attr('aria-pressed', false);
      $headerButton.addClass('active').attr('aria-pressed', true);

      updateColorPicker();
    };

    /**
     * Create scene selector
     *
     * @private
     * @param {string} option Label of scene selector
     * @param {boolean} isVisible Initial visibility of scene selector
     * @returns {jQuery} Scene selector that was created
     */
    var createSceneselector = function (option, isVisible) {
      // First scene selector will be active
      var first = isVisible ? ' show' : '';
      var active = isVisible ? ' active' : '';

      // Content element
      var $content = $('<div>', {
        class: 'h5p-scene-selector-content' + first
      }).appendTo($contentWrapper);

      // Option for showing content
      var $sceneSelectorOption = $('<a>', {
        'class': 'h5p-scene-selector-option' + active,
        href: 'javascript:void(0)',
        html: option,
        on: {
          click: function () {
            changeSceneType($content);
          },
          keypress: function (event) {
            if (event.which === 32) { // Space
              changeSceneType($content);
              return false;
            }

          }
        },
        appendTo: $header
      });

      if (isVisible) {
        $sceneSelectorOption.attr('aria-pressed', true);
      }

      return $content;
    };

    /**
     * Update color picker in current scene
     *
     * @private
     */
    var updateColorPicker = function () {
      if (isSingleScene() && singleScenes[currentScene]) {
        singleScenes[currentScene].updateColorPicker();
      }
      else {
        globalBackground.updateColorPicker();
      }
    };

    /**
     * Determine if selected scene is a single scene
     *
     * @private
     * @returns {boolean} True if currently selected scene is a single scene
     */
    var isSingleScene = function () {
      return $sceneContent.hasClass('show');
    };

    /**
     * Append scene selector to wrapper
     *
     * @param {jQuery} $wrapper Wrapper we attach to
     * @returns {H5PEditor.BookMaker.SceneSelector}
     */
    self.appendTo = function ($wrapper) {
      self.$wrapper = $wrapper;
      initBgSelectors();
      initSceneOperationsListeners();
      $popup.appendTo($wrapper);

      return self;
    };

    /**
     * Open popup
     * @returns {H5PEditor.BookMaker.SceneSelector}
     */
    self.open = function () {
      if (self.$wrapper) {
        self.$wrapper.removeClass('hidden');
        isOpen = true;
      }

      return self;
    };

    /**
     * Close popup
     * @returns {H5PEditor.BookMaker.SceneSelector}
     */
    self.close = function () {
      if (self.$wrapper) {
        self.$wrapper.addClass('hidden');
        isOpen = false;
      }

      return self;
    };

    /**
     * Toggle popup state
     * @returns {H5PEditor.BookMaker.SceneSelector}
     */
    self.toggleOpen = function () {
      if (self.$wrapper) {
        if (isOpen) {
          self.close();
        }
        else {
          self.open();
        }

        updateColorPicker();
      }

      return self;
    };

    /**
     * Communicate when we are ready
     *
     * @returns {boolean} True if ready
     */
    self.ready = function () {
      return true; // Always ready
    };

    /**
     * Checks validity of user input
     *
     * @returns {boolean} True if valid
     */
    self.validate = function () {
      var valid = true;
      valid &= globalBackground.validate();

      singleScenes.forEach(function (singleScene) {
        valid &= singleScene.validate();
      });

      return valid;
    };
  }

  // Inheritance
  SceneSelector.prototype = Object.create(EventDispatcher.prototype);
  SceneSelector.prototype.constructor = SceneSelector;

  return SceneSelector;
})(H5P.jQuery, H5P.EventDispatcher);
