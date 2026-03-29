console.log('Cincinnati 311 Task 1 loaded');

const SERVICE_KEYWORD = 'TRASH';
let leafletMap = null;

// Load the sample data that came with the starter code.
d3.csv('data/311Sample.csv')
  .then(data => {
    console.log('Rows loaded:', data.length);

    // Keep only trash-related service requests for Task 1.
    const trashData = data.filter(d => {
      const desc = String(d.SR_TYPE_DESC || '').toUpperCase();
      return desc.includes(SERVICE_KEYWORD);
    });

    // Clean numeric/date fields we need later.
    trashData.forEach(d => {
      d.LATITUDE = +d.LATITUDE;
      d.LONGITUDE = +d.LONGITUDE;

      d.createdDate = d.DATE_CREATED ? new Date(d.DATE_CREATED) : null;
      d.lastUpdateDate = d.DATE_LAST_UPDATE ? new Date(d.DATE_LAST_UPDATE) : null;

      if (d.createdDate && d.lastUpdateDate && !Number.isNaN(d.createdDate) && !Number.isNaN(d.lastUpdateDate)) {
        const msPerDay = 1000 * 60 * 60 * 24;
        d.daysToUpdate = Math.max(0, (d.lastUpdateDate - d.createdDate) / msPerDay);
      } else {
        d.daysToUpdate = null;
      }
    });

    leafletMap = new LeafletMap({ parentElement: '#my-map' }, trashData);
  })
  .catch(error => console.error(error));
