declare module "react-plotly.js" {
  import { Component } from "react";
  import type { PlotParams } from "plotly.js-dist-min";
  export default class Plot extends Component<PlotParams> {}
}
