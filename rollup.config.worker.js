import rollupConfig from './rollup.config';

const packageConfig = {
  ...rollupConfig,

  input: 'src/expand-layers-worker.js',
  output: {
    ...rollupConfig.output,
    name: 'worker',
    file: 'public/worker.js'
  }
};

export default packageConfig;
