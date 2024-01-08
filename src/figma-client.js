import axios from 'axios';

const FIGMA_API_BASE_URL = 'https://api.figma.com/v1';

const figmaClient = (token) => {
  const instance = axios.create({
    baseURL: FIGMA_API_BASE_URL,
  });

  instance.interceptors.request.use((conf) => {
    conf.headers = {
      'Content-Type': 'application/json',
      'X-Figma-Token': token,
    };
    conf.startTime = new Date().getTime();
    return conf;
  });

  instance.interceptors.response.use(
    (response) => {
      response.config.endTime = new Date().getTime();
      response.duration = response.config.endTime - response.config.startTime;
      return response;
    },
    (error) => {
      error.config.endTime = new Date().getTime();
      error.duration = error.config.endTime - error.config.startTime;
      return Promise.reject(error);
    },
  );

  return instance;
};

export default figmaClient;
