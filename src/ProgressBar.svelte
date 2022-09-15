<script>
  export let progress;

  // width - margins
  $: fullWidth = 360 - 6;
  $: loadedWidth = progress !== null && fullWidth * progress;
</script>

<div class="container">
  <div class="grayed-out" />
  <div class="loading-text">Loading ...</div>
  <div class="progress-bar">
    <div class="progress" style={`width: ${loadedWidth}px`} />
  </div>
</div>

<style>
  .container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }

  .grayed-out {
    background-color: gray;
    opacity: 50%;
    width: 100%;
    height: 100%;
    position: absolute;
    z-index: 0;
  }

  .loading-text {
    margin-bottom: 12px;
    font-size: 24px;
    color: white;
    z-index: 1;
  }

  .progress-bar {
    width: 360px;
    height: 24px;
    border-radius: 24px;
    border: 2px solid white;
    z-index: 1;
  }

  .progress {
    height: calc(100% - 6px);
    background-color: greenyellow;
    transition: all ease 0.1s;
    border-radius: 18px;
    margin: 3px;
  }
</style>
