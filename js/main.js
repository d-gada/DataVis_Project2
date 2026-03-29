const SERVICE_KEYWORD = "TRASH";

let leafletMap, timeline, barNeighborhood, barMethod, barDept, barPriority;
let allData = [];

const dispatcher = d3.dispatch("selectionChanged");

function updateAllViews(filteredData, sourceView) {
  if (sourceView !== "map")
    leafletMap.filterByIds(new Set(filteredData.map((d) => d.SR_NUMBER)));
  if (sourceView !== "timeline") timeline.updateVis(filteredData);
  if (sourceView !== "neighborhood") barNeighborhood.updateVis(filteredData);
  if (sourceView !== "method") barMethod.updateVis(filteredData);
  if (sourceView !== "dept") barDept.updateVis(filteredData);
  if (sourceView !== "priority") barPriority.updateVis(filteredData);

  d3.select("#clearBtn").style(
    "display",
    filteredData.length < allData.length ? "block" : "none",
  );
}

dispatcher.on("selectionChanged", (filteredData, sourceView) => {
  updateAllViews(filteredData, sourceView);
});

d3.csv("data/311Sample.csv").then((data) => {
  const trashData = data.filter((d) =>
    String(d.SR_TYPE_DESC || "")
      .toUpperCase()
      .includes(SERVICE_KEYWORD),
  );

  trashData.forEach((d) => {
    d.LATITUDE = +d.LATITUDE;
    d.LONGITUDE = +d.LONGITUDE;
    d.createdDate = d.DATE_CREATED ? new Date(d.DATE_CREATED) : null;
    d.lastUpdateDate = d.DATE_LAST_UPDATE ? new Date(d.DATE_LAST_UPDATE) : null;
    if (
      d.createdDate &&
      d.lastUpdateDate &&
      !isNaN(d.createdDate) &&
      !isNaN(d.lastUpdateDate)
    ) {
      d.daysToUpdate = Math.max(
        0,
        (d.lastUpdateDate - d.createdDate) / (1000 * 60 * 60 * 24),
      );
    } else {
      d.daysToUpdate = null;
    }
  });

  allData = trashData;

  leafletMap = new LeafletMap(
    { parentElement: "#my-map" },
    allData,
    dispatcher,
  );
  timeline = new Timeline(
    { parentElement: "#timeline-chart" },
    allData,
    dispatcher,
  );
  barNeighborhood = new BarChart(
    {
      parentElement: "#chart-neighborhood",
      field: "NEIGHBORHOOD",
      sourceKey: "neighborhood",
    },
    allData,
    dispatcher,
  );
  barMethod = new BarChart(
    {
      parentElement: "#chart-method",
      field: "METHOD_RECEIVED",
      sourceKey: "method",
    },
    allData,
    dispatcher,
  );
  barDept = new BarChart(
    { parentElement: "#chart-dept", field: "DEPT_NAME", sourceKey: "dept" },
    allData,
    dispatcher,
  );
  barPriority = new BarChart(
    {
      parentElement: "#chart-priority",
      field: "PRIORITY",
      sourceKey: "priority",
    },
    allData,
    dispatcher,
  );

  d3.select("#clearBtn").on("click", () => {
    dispatcher.call("selectionChanged", null, allData, "clear");
    d3.select("#clearBtn").style("display", "none");
  });
});
