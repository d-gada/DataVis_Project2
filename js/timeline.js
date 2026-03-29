class Timeline {
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      margin: { top: 20, right: 30, bottom: 60, left: 60 },
    };
    this.data = _data;
    this.dispatcher = _dispatcher;
    this.initVis();
  }

  initVis() {
    let vis = this;
    const m = vis.config.margin;
    const containerW = document.querySelector(
      vis.config.parentElement,
    ).clientWidth;

    vis.width = containerW - m.left - m.right;
    vis.height = 260 - m.top - m.bottom;

    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.width + m.left + m.right)
      .attr("height", vis.height + m.top + m.bottom)
      .append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    vis.xScale = d3.scaleBand().range([0, vis.width]).padding(0.15);
    vis.yScale = d3.scaleLinear().range([vis.height, 0]);

    vis.xAxisG = vis.svg
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.height})`);
    vis.yAxisG = vis.svg.append("g").attr("class", "axis y-axis");

    vis.svg
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -vis.height / 2)
      .attr("y", -46)
      .attr("text-anchor", "middle")
      .text("Number of requests");

    vis.svg
      .append("text")
      .attr("class", "axis-label")
      .attr("x", vis.width / 2)
      .attr("y", vis.height + 52)
      .attr("text-anchor", "middle")
      .text("Week of year (2025)");

    vis.barsG = vis.svg.append("g");

    // d3 brush
    vis.brush = d3
      .brushX()
      .extent([
        [0, 0],
        [vis.width, vis.height],
      ])
      .on("end", function (event) {
        if (!event.selection) {
          vis.dispatcher.call("selectionChanged", null, allData, "timeline");
          return;
        }
        const [x0, x1] = event.selection;
        const selected = vis.weeklyData.filter((d) => {
          const bx = vis.xScale(d.week);
          return bx + vis.xScale.bandwidth() > x0 && bx < x1;
        });
        const selectedWeeks = new Set(selected.map((d) => d.week.getTime()));
        const filtered = allData.filter(
          (d) =>
            d.createdDate &&
            selectedWeeks.has(d3.timeWeek.floor(d.createdDate).getTime()),
        );
        vis.dispatcher.call("selectionChanged", null, filtered, "timeline");
      });

    vis.brushG = vis.svg.append("g").attr("class", "brush").call(vis.brush);

    vis.updateVis(vis.data);
  }

  updateVis(data) {
    let vis = this;
    vis.data = data;

    const weeklyMap = d3.rollup(
      vis.data.filter(
        (d) => d.createdDate instanceof Date && !isNaN(d.createdDate),
      ),
      (v) => v.length,
      (d) => d3.timeWeek.floor(d.createdDate),
    );

    vis.weeklyData = Array.from(weeklyMap, ([week, count]) => ({
      week,
      count,
    })).sort((a, b) => a.week - b.week);

    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    vis.xScale.domain(vis.weeklyData.map((d) => d.week));
    vis.yScale.domain([0, d3.max(vis.weeklyData, (d) => d.count)]).nice();

    const monthStarts = vis.weeklyData.filter(
      (d, i) =>
        i === 0 || d.week.getMonth() !== vis.weeklyData[i - 1].week.getMonth(),
    );

    vis.xAxisG
      .call(
        d3
          .axisBottom(vis.xScale)
          .tickValues(monthStarts.map((d) => d.week))
          .tickFormat(d3.timeFormat("%b %Y")),
      )
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

    vis.yAxisG.call(
      d3.axisLeft(vis.yScale).ticks(5).tickFormat(d3.format("d")),
    );

    const bars = vis.barsG
      .selectAll(".timeline-bar")
      .data(vis.weeklyData, (d) => d.week);

    bars
      .enter()
      .append("rect")
      .attr("class", "timeline-bar")
      .attr("fill", "#4a7fa5")
      .attr("rx", 2)
      .merge(bars)
      .attr("x", (d) => vis.xScale(d.week))
      .attr("y", (d) => vis.yScale(d.count))
      .attr("width", vis.xScale.bandwidth())
      .attr("height", (d) => vis.height - vis.yScale(d.count))
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "#0e2f4e");
        const weekEnd = new Date(d.week);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const fmt = d3.timeFormat("%b %d, %Y");
        d3.select("#tooltip").style("opacity", 1)
          .html(`<div class="tooltip-title">Week of ${fmt(d.week)}</div>
                   <div><strong>Week ending:</strong> ${fmt(weekEnd)}</div>
                   <div><strong>Requests:</strong> ${d.count}</div>`);
      })
      .on("mousemove", (event) => {
        d3.select("#tooltip")
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY + 12 + "px");
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill", "#4a7fa5");
        d3.select("#tooltip").style("opacity", 0);
      });

    bars.exit().remove();
  }
}
