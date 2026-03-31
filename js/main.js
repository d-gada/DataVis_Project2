let leafletMap, timeline, barNeighborhood, barMethod, barDept, barPriority;
let allData = [];

const dispatcher = d3.dispatch("selectionChanged");

function updateAllViews(filteredData, sourceView) {
  const dataToShow = filteredData || allData;

  if (sourceView !== "map")
    leafletMap.filterByIds(new Set(dataToShow.map((d) => d.SR_NUMBER)));

  if (sourceView !== "timeline") timeline.updateVis(dataToShow);
  if (sourceView !== "neighborhood") barNeighborhood.updateVis(dataToShow);
  if (sourceView !== "method") barMethod.updateVis(dataToShow);
  if (sourceView !== "dept") barDept.updateVis(dataToShow);
  if (sourceView !== "priority") barPriority.updateVis(dataToShow);

  d3.select("#clearBtn").style(
    "display",
    dataToShow.length < allData.length ? "block" : "none",
  );
}

dispatcher.on("selectionChanged", (filteredData, sourceView) => {
  updateAllViews(filteredData, sourceView);
});

d3.csv("data/311_Trash_processed.csv")
  .catch(() => d3.csv("data/311Sample_old.csv"))
  .catch(() => d3.csv("data/311Sample.csv"))
  .then((data) => {
  data.forEach((d) => {
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

  allData = data;

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

