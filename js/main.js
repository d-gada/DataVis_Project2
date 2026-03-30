let leafletMap, timeline, barNeighborhood, barMethod, barDept, barPriority;
let allData = [];
let trashData = [];
let constructionData = [];
let currentRequestType = "both";

const dispatcher = d3.dispatch("selectionChanged");

function updateAllViews(filteredData, sourceView) {
  const dataToShow = filteredData || allData;

  if (sourceView !== "map")
    leafletMap.filterByIds(new Set(dataToShow.map((d) => d.SR_NUMBER)));

  // Keep all non-map charts in sync with the active subset, including timeline brushing.
  timeline.updateVis(dataToShow);
  if (sourceView !== "neighborhood") barNeighborhood.updateVis(dataToShow);
  if (sourceView !== "method") barMethod.updateVis(dataToShow);
  if (sourceView !== "dept") barDept.updateVis(dataToShow);
  if (sourceView !== "priority") barPriority.updateVis(dataToShow);

  d3.select("#clearBtn").style(
    "display",
    dataToShow.length < allData.length ? "block" : "none",
  );
}

function switchTab(type) {
  currentRequestType = type;
  
  if (type === "trash") {
    allData = trashData;
  } else if (type === "construction") {
    allData = constructionData;
  } else {
    allData = [...trashData, ...constructionData];
  }
  
  // Update tab UI
  d3.selectAll(".tab-button").classed("active", (_, i) => {
    const tab = d3.select(d3.selectAll(".tab-button").nodes()[i]).attr("data-tab");
    return tab === type;
  });
  
  // Update map title and service type label
  const titleMap = {
    trash: "Trash-Related Service Requests",
    construction: "Construction-Related Service Requests",
    both: "Trash and Construction Service Requests",
  };
  const labelMap = {
    trash: "Trash",
    construction: "Construction",
    both: "Both",
  };
  d3.select("#mapTitle").text(titleMap[type]);
  d3.select("#serviceTypeLabel").text(labelMap[type]);
  
  // Update map with new request type
  leafletMap.setRequestType(type);
  
  dispatcher.call("selectionChanged", null, allData, "typeFilter");
}

dispatcher.on("selectionChanged", (filteredData, sourceView) => {
  updateAllViews(filteredData, sourceView);
});

d3.selectAll(".tab-button").on("click", function () {
  switchTab(d3.select(this).attr("data-tab"));
});

Promise.all([
  d3.csv("data/311_Trash_processed.csv").catch(() =>
    d3.csv("data/311Sample_old.csv")
  ),
  d3.csv("data/311_Construction_processed.csv")
])
  .then(([trashCsv, constructionCsv]) => {
    // Process data helper
    const processData = (data, type) => {
      data.forEach((d) => {
        d.LATITUDE = +d.LATITUDE;
        d.LONGITUDE = +d.LONGITUDE;
        d.requestType = type;
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
      return data;
    };

    trashData = processData(trashCsv || [], "trash");
    constructionData = processData(constructionCsv || [], "construction");
    allData = [...trashData, ...constructionData];

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

    switchTab("both");

    d3.select("#clearBtn").on("click", () => {
      dispatcher.call("selectionChanged", null, allData, "clear");
      d3.select("#clearBtn").style("display", "none");
   
      console.log("=== DATA INITIALIZATION COMPLETE ===");
      console.log("Total allData records:", allData.length);
      console.log("Trash records:", trashData.length);
      console.log("Construction records:", constructionData.length);
      console.log("First trash record sample:", trashData[0] ? { SR_NUMBER: trashData[0].SR_NUMBER, requestType: trashData[0].requestType, POLICE_DISTRICT: trashData[0].POLICE_DISTRICT, LATITUDE: trashData[0].LATITUDE } : "NONE");
      console.log("=== Check browser console for buildDistrictPolygons and renderPerceptionOverlay logs ===");
    });
  });

