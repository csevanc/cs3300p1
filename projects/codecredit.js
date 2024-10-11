// used code from website on how to make a line chart have a color gradient: https://d3-graph-gallery.com/graph/line_color_gradient_svg.html
// VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV

chartArea.append("linearGradient")
  .attr("id", "line-gradient")
  .attr("gradientUnits", "userSpaceOnUse")
  .attr("x1", 0)
  .attr("y1", yScale(changeExtent[0]))
  .attr("x2", 0)
  .attr("y2", yScale(changeExtent[1]))
  .selectAll("stop")
  .data([
    { offset: "0%", color: "#58eb34" },
    { offset: "100%", color: "#525451" }
  ])
  .enter().append("stop")
  .attr("offset", function (d) { return d.offset; })
  .attr("stop-color", function (d) { return d.color; });

// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

// Flexible legend-drawing function - Jeff Rzeszotarski, 2024
//   Released under MIT Free license
//  Takes in an SVG element selector <legendSelector> and a d3 color scale <legendColorScale>
//
// Usage example: drawLegend("#legendID", grossIncomeColorScale)
// VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV

function drawLegend(legendSelector, legendColorScale) {

  // This code should adapt to a variety of different kinds of color scales
  //  Credit Prof. Rz if you are basing a legend on this structure, and note PERFORMANCE CONSIDERATIONS

  // Shrink legend bar by 5 px inwards from sides of SVG
  const offsets = {
    width: 10,
    top: 2,
    bottom: 24
  };
  // Number of integer 'pixel steps' to draw when showing continuous scales
  //    Warning, not using a canvas element so lots of rect tags will be created for low stepSize, causing issues with performance -- keep this large
  const stepSize = 4;
  // Extend the minmax by 0% in either direction to expose more features by default
  const minMaxExtendPercent = 0;


  const legend = d3.select(legendSelector);
  const legendHeight = legend.attr("height");
  const legendBarWidth = legend.attr("width") - (offsets.width * 2);
  const legendMinMax = d3.extent(legendColorScale.domain());
  // recover the min and max values from most kinds of numeric scales
  const minMaxExtension = (legendMinMax[1] - legendMinMax[0]) * minMaxExtendPercent;
  const barHeight = legendHeight - offsets.top - offsets.bottom;

  // In this case the "data" are pixels, and we get numbers to use in colorScale
  // Use this to make axis labels
  let barScale = d3.scaleLinear().domain([legendMinMax[0] - minMaxExtension,
  legendMinMax[1] + minMaxExtension])
    .range([0, legendBarWidth]);
  let barAxis = d3.axisBottom(barScale);

  // Place for bar slices to live
  let bar = legend.append("g")
    .attr("class", "legend colorbar")
    .attr("transform", `translate(${offsets.width},${offsets.top})`)

  // ****** SWITCHES FOR DIFFERENT SCALE TYPES ******

  // Check if we're using a binning scale - if so, we make blocks of color
  if (legendColorScale.hasOwnProperty('thresholds') || legendColorScale.hasOwnProperty('quantiles')) {
    // Get the thresholds
    let thresholds = [];
    if (legendColorScale.hasOwnProperty('thresholds')) { thresholds = legendColorScale.thresholds() }
    else { thresholds = legendColorScale.quantiles() }

    const barThresholds = [legendMinMax[0], ...thresholds, legendMinMax[1]];

    // Use the quantile breakpoints plus the min and max of the scale as tick values
    barAxis.tickValues(barThresholds);

    // Draw rectangles between the threshold segments
    for (let i = 0; i < barThresholds.length - 1; i++) {
      let dataStart = barThresholds[i];
      let dataEnd = barThresholds[i + 1];
      let pixelStart = barAxis.scale()(dataStart);
      let pixelEnd = barAxis.scale()(dataEnd);

      bar.append("rect")
        .attr("x", pixelStart)
        .attr("y", 0)
        .attr("width", pixelEnd - pixelStart)
        .attr("height", barHeight)
        .style("fill", legendColorScale((dataStart + dataEnd) / 2.0));
    }
  }
  // Else if we have a continuous / roundable scale
  //  In an ideal world you might construct a custom gradient mapped to the scale
  //  For this one, we use a hack of making stepped rects
  else if (legendColorScale.hasOwnProperty('rangeRound')) {
    // NOTE: The barAxis may round min and max values to make them pretty
    // ** This also means there is a risk of the legend going beyond scale bounds
    // We need to use the barAxis min and max just to be sure the bar is complete
    //    Using barAxis.scale().invert() goes from *axis* pixels to data values easily
    // ** We also need to create patches for the scale if the labels exceed bounds
    //     (floating point comparisons risky for small data ranges,but not a big deal
    //      because patches will be indistinguishable from actual scale bottom)
    // It's likely that scale clamping will actually do this for us elegantly
    // ...but better to be safer and patch the regions anyways

    for (let i = 0; i < legendBarWidth; i = i + stepSize) {

      let center = i + (stepSize / 2);
      let dataCenter = barAxis.scale().invert(center);

      // below normal scale bounds
      if (dataCenter < legendMinMax[0]) {
        bar.append("rect")
          .attr("x", i)
          .attr("y", 0)
          .attr("width", stepSize)
          .attr("height", barHeight)
          .style("fill", legendColorScale(legendMinMax[0]));
      }
      // within normal scale bounds
      else if (dataCenter < legendMinMax[1]) {
        bar.append("rect")
          .attr("x", i)
          .attr("y", 0)
          .attr("width", stepSize)
          .attr("height", barHeight)
          .style("fill", legendColorScale(dataCenter));
      }
      // above normal scale bounds
      else {
        bar.append("rect")
          .attr("x", i)
          .attr("y", 0)
          .attr("width", stepSize)
          .attr("height", barHeight)
          .style("fill", legendColorScale(legendMinMax[1]));
      }

    }
  }
  // Otherwise we have a nominal scale
  else {
    let nomVals = legendColorScale.domain().sort();

    // Use a scaleBand to make blocks of color and simple labels
    let barScale = d3.scaleBand().domain(nomVals)
      .range([0, legendBarWidth])
      .padding(0.05);
    barAxis.scale(barScale);

    // Draw rectangles for each nominal entry
    nomVals.forEach(d => {
      bar.append("rect")
        .attr("x", barScale(d))
        .attr("y", 0)
        .attr("width", barScale.bandwidth())
        .attr("height", barHeight)
        .style("fill", legendColorScale(d));
    });
  }
  // DONE w/SWITCH

  // Finally, draw legend labels
  legend.append("g")
    .attr("class", "legend axis")
    .attr("transform", `translate(${offsets.width},${offsets.top + barHeight + 5})`)
    .call(barAxis);

}

// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

// used code on how to calcuate least squares given a set of data and create a trend line : https://gist.github.com/benvandyke/8459843

// get the x and y values for least squares
// VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV

var xSeries = d3.range(1, xLabels.length + 1);
var ySeries = data.map(function (d) { return parseFloat(d['rate']); });

var leastSquaresCoeff = leastSquares(xSeries, ySeries);

// apply the reults of the least squares regression
var x1 = xLabels[0];
var y1 = leastSquaresCoeff[0] + leastSquaresCoeff[1];
var x2 = xLabels[xLabels.length - 1];
var y2 = leastSquaresCoeff[0] * xSeries.length + leastSquaresCoeff[1];
var trendData = [[x1, y1, x2, y2]];

var trendline = svg.selectAll(".trendline")
  .data(trendData);

trendline.enter()
  .append("line")
  .attr("class", "trendline")
  .attr("x1", function (d) { return xScale(d[0]); })
  .attr("y1", function (d) { return yScale(d[1]); })
  .attr("x2", function (d) { return xScale(d[2]); })
  .attr("y2", function (d) { return yScale(d[3]); })
  .attr("stroke", "black")
  .attr("stroke-width", 1);

// display equation on the chart
svg.append("text")
  .text("eq: " + decimalFormat(leastSquaresCoeff[0]) + "x + " +
    decimalFormat(leastSquaresCoeff[1]))
  .attr("class", "text-label")
  .attr("x", function (d) { return xScale(x2) - 60; })
  .attr("y", function (d) { return yScale(y2) - 30; });

// display r-square on the chart
svg.append("text")
  .text("r-sq: " + decimalFormat(leastSquaresCoeff[2]))
  .attr("class", "text-label")
  .attr("x", function (d) { return xScale(x2) - 60; })
  .attr("y", function (d) { return yScale(y2) - 10; });

// returns slope, intercept and r-square of the line
function leastSquares(xSeries, ySeries) {
  var reduceSumFunc = function (prev, cur) { return prev + cur; };

  var xBar = xSeries.reduce(reduceSumFunc) * 1.0 / xSeries.length;
  var yBar = ySeries.reduce(reduceSumFunc) * 1.0 / ySeries.length;

  var ssXX = xSeries.map(function (d) { return Math.pow(d - xBar, 2); })
    .reduce(reduceSumFunc);

  var ssYY = ySeries.map(function (d) { return Math.pow(d - yBar, 2); })
    .reduce(reduceSumFunc);

  var ssXY = xSeries.map(function (d, i) { return (d - xBar) * (ySeries[i] - yBar); })
    .reduce(reduceSumFunc);

  var slope = ssXY / ssXX;
  var intercept = yBar - (xBar * slope);
  var rSquare = Math.pow(ssXY, 2) / (ssXX * ssYY);

  return [slope, intercept, rSquare];
}

// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^