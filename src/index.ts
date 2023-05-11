import express, { Request, Response } from "express";

const app = express();

app.get("/api", (_: Request, res: Response) => {
  res.setHeader("Content-type", "text/html");
  res.send(`<p>Hello My Lexi World! ${process.env.NODE_ENV}</p>`);
});

const port = (process.env.APP_PORT && +process.env.APP_PORT) || 3000;

app.listen(port, () => {
  console.log(`Listening on port ${port}!`);
});
