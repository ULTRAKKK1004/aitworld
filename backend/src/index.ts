import app from './app';
import { BigAgent } from './services/bigAgent';

const PORT = process.env.PORT || 4000;

const bigAgent = new BigAgent();
bigAgent.start();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
