<script>
  import { onDestroy, createEventDispatcher, onMount } from 'svelte';
  import { fetchUrl } from './fetch-url';
  import { shortcut } from './shortcut';
  import { stylesEqual } from './styles/styles-equal';
  import { mapboxGlAccessTokenStore, styleStore } from './stores';

  const dispatch = createEventDispatcher();

  export let activeStyle;
  export let activeUrl;
  export let disabled = false;

  let currentStyle;

  let textInput = '';

  let focused = false;
  let error = null;

  let allowPolling = true;

  let selectedUrl = '';

  onDestroy(() => {
    // Cancel any polling in destroyed components
    allowPolling = false;
  });

  onMount(() => {
    if (activeUrl) {
      selectedUrl = activeUrl;
      fetchStyle(activeUrl);
    }
  });

  // This will continue to poll/fetch the style at a local URL to allow live changes to be picked up
  const poll = url => {
    console.log(selectedUrl);

    const pollCondition = str => {
      if (!allowPolling || !str || selectedUrl !== str) return false;
      if (!stylesEqual(currentStyle, activeStyle)) return false;
      const absolutePathRegex = new RegExp('^(?:[a-z+]+:)?//', 'i');
      return str.includes('localhost') || !absolutePathRegex.test(str);
    };

    // Simple polling for any style on localhost
    // Check that should poll to set timer
    if (pollCondition(url)) {
      // Check poll condition again to cancel action for a url
      setTimeout(() => pollCondition(url) && fetchStyle(url), 3000);
    }
  };

  // Fetch the style json from the URL
  const fetchStyle = async url => {
    let style;
    try {
      const data = await fetchUrl(url);
      // TODO make a better check that it is style and not arbitrary object
      if (data && typeof data === 'object') {
        // TODO create checks by type for non-mapbox maps
        style = data;

        poll(url);
        currentStyle = style;
        dispatch('styleload', { style, url });
        return { status: '200' };
      }
    } catch (err) {
      error = new Error('Style was not found.');
      return { status: '404' };
    }
  };

  const setMapboxToken = url => {
    const tokenRegex = /pk.([\w.]+)/g;
    let nextToken = url.split('access_token').pop();
    nextToken = nextToken.match(tokenRegex)?.[0];
    if ($mapboxGlAccessTokenStore === nextToken) return;
    mapboxGlAccessTokenStore.set(nextToken);
  };

  // Change the URL by fetching the style and polling if necessary
  const onChangeUrl = async url => {
    const { status } = await fetchStyle(url);
    if (status === '200') {
      selectedUrl = url;
      setMapboxToken(url);
      poll(url);
    }
  };

  // Submit URL from a custom or branch style
  const submitUrl = async () => {
    // Branch values always have an `id` field
    let nextLocalUrl = textInput;

    if (nextLocalUrl.includes('localhost')) {
      const [preface, address] = nextLocalUrl.split('localhost');
      // Fetch doesn't accept localhost unless prefaced with http://
      // This adds the preface if not present
      if (!preface) {
        nextLocalUrl = `http://localhost${address}`;
      }
    }
    onChangeUrl(nextLocalUrl);
  };

  const onKeySubmit = () => {
    if (focused) {
      submitUrl();
    }
  };

  const handleOnFocus = () => {
    focused = true;
  };

  const handleOnBlur = () => {
    focused = false;
    if (error) {
      textInput = '';
    }
  };

  const resetTextInput = () => {
    if (!stylesEqual(currentStyle, activeStyle)) {
      textInput = '';
    }
  };

  const resetError = text => {
    if (!error || text === undefined) return;
    error = null;
  };

  // Reset error on beginning to type again
  $: resetError(textInput);

  $: {
    activeStyle;
    resetTextInput();
  }
</script>

<div class="map-style-input">
  {#if !!error}
    <div class="error-message">
      {error}
    </div>
  {/if}
  <div class="custom-input">
    <input
      class:input-error={error}
      bind:value={textInput}
      on:focus={handleOnFocus}
      on:blur={handleOnBlur}
      placeholder={'enter a url to a style'}
      {disabled}
    />
    <button
      use:shortcut={{ code: 'Enter', callback: onKeySubmit }}
      on:click={submitUrl}
      disabled={selectedUrl === textInput || disabled}>Submit</button
    >
  </div>
</div>

<style>
  .map-style-input {
    display: flex;
  }

  .custom-input {
    margin-top: 0px;
  }

  .input-error:focus {
    outline: none;
    border-color: red;
  }

  .error-message {
    background-color: lightcoral;
    border-style: solid;
    border-color: red;
    border-width: 1px;
    border-radius: 4px;
    padding: 6px;
    color: white;
    margin-right: 6px;
    height: 18px;
  }
</style>
