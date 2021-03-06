$(document).on('turbolinks:load', function() {
  if ($('#licks').length > 0) {
    Handlebars.registerHelper('tonalities', function(lick) {
      if (lick.tonalities.length > 0) {
        let tonalitiesList = "("
        for (let tonality of lick.tonalities) {
          tonalitiesList += `${tonality.name}, `
        }
        tonalitiesList = tonalitiesList.replace(/,\s*$/, ")")
        return tonalitiesList;
      };
    })

    Handlebars.registerHelper('lastPracticedDate', function(lick) {
      if (lick.last_practiced) {
        const currentLick = new Lick(lick);
        let dateHTML = '(' + currentLick.formatDate("last_practiced") + ')';
        return dateHTML;
      }
    })

    Handlebars.registerHelper('scheduledPracticeDate', function(lick) {
      if (lick.scheduled_practice) {
        const currentLick = new Lick(lick);
        let dateHTML = '(' + currentLick.formatDate("scheduled_practice") + ')';
        return dateHTML;
      }
    })

    Handlebars.registerHelper('lickShowLastPracticedDate', function(lick) {
      const currentLick = new Lick(lick);
      return currentLick.formatDate("last_practiced");
    })

    Handlebars.registerHelper('lickShowScheduledPracticeDate', function(lick) {
      const currentLick = new Lick(lick);
      return currentLick.formatDate("scheduled_practice");
    })

    Handlebars.registerHelper('infoAvailable', function(lick) {
      if (lick["bpm"] === null && lick["current_key"] === null && lick["description"] === null && lick["last_practiced"] === null && lick["performance_rating"] === null && lick["scheduled_practice"] === null) {
        return "<li>There isn't any information available for this lick, yet!</li>"
      }
    })

    Handlebars.registerPartial('tonality-list-items', document.getElementById('tonality-list-items').innerHTML);
    Handlebars.registerPartial('last-practiced-list-items', document.getElementById('last-practiced-list-items').innerHTML);
    Handlebars.registerPartial('scheduled-practice-list-items', document.getElementById('scheduled-practice-list-items').innerHTML);

    displayIndexOptions();

    renderLicks();
  };
});

// to implement JavaScript OOP requirement
let Lick = function(attributes) {
  const keys = Object.keys(attributes);
  for (let key of keys) { this[key] = attributes[key] }
}

Lick.prototype.formatDate = function(desiredDateKey) {
  const date = new Date(this[desiredDateKey]);
  let dateInfo = `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
  return dateInfo;
}

Lick.prototype.displayBasicLickInfo = function() {
  //make a template for "basic information", remove licks#index and replace with specific lick info
  const template = Handlebars.compile(document.getElementById('lick-show-basic-info').innerHTML);
  const lickHTML = template(this);
  $('#licks').html(lickHTML);
}

Lick.prototype.displayLickTonalities = function() {
  //make a template for "tonalities" associated with lick and display on page
  if (this.tonalities.length > 0) {
    const template = Handlebars.compile(document.getElementById('lick-show-tonalities-list').innerHTML);
    const tonalitiesHTML = template(this.tonalities)
    $('#licks').append(tonalitiesHTML);
  } else {
    $('#licks').append("<h4>Tonalities</h4><ul><li>This lick doesn't currently have any tonalities</li></ul>");
  }
}

Lick.prototype.displayLickBackingTracks = function() {
  //make a template for "backing_tracks" associated with lick and display on page
  if (this.backing_tracks.length > 0) {
    const template = Handlebars.compile(document.getElementById('lick-show-backing-tracks-list').innerHTML);
    const backingTracksHTML = template(this.backing_tracks)
    $('#licks').append(backingTracksHTML);
  } else {
    $('#licks').append("<h4>Backing Tracks</h4><ul><li>This lick doesn't currently have any backing tracks</li></ul>");
  }
}

Lick.prototype.displayLickShowOptions = function() {
  //make a template for "show options" that displays the "edit lick" and "delete lick" buttons
  const template = Handlebars.compile(document.getElementById('lick-show-options').innerHTML);
  const optionsHTML = template(this);
  $('#view-options').html(optionsHTML);
  this.attachDeleteHandler();
  attachBackHandler();
}

Lick.prototype.displayNotes = function() {
  //get Handlebars templates for notes and use callbacks with closures to pass lickData and templateData along
  $.get(`/users/${this.user_id}/notes`, notesIndexTemplateCallback(this));
}

Lick.prototype.attachDeleteHandler = function() {
  // attach click handler to delete button and use a closure to pass data and the event
  $('button#delete-lick-button').on('click', deleteHandler(this));
}

function renderLicks() {
  // pull user ID from the url for JSON request
  const userId = window.location.href.match(/\/users\/\d\/licks/)[0].match(/\d/)[0];
  const filterAndSortParams = {
    filter: $('select#filter')[0].value,
    sort: $('select#sort')[0].value
  }

  //sends ajax request and delegates to appropriate callback function to display licks
  $.getJSON(`/users/${userId}/licks`, filterAndSortParams, displayCallback(filterAndSortParams));
}

function displayCallback(filterAndSortParams) {
  //determines how to display licks, based on "sort" option
  if (filterAndSortParams["sort"] === "") {
    return function(data) { displayUnsortedLicks(data, filterAndSortParams); }
  } else if (filterAndSortParams["sort"] === "Tonality") {
    return function(data) { displayTonalityOrArtistSort(data, filterAndSortParams); }
  } else if (filterAndSortParams["sort"] === "Artist") {
    return function(data) { displayTonalityOrArtistSort(data, filterAndSortParams); }
  } else if (filterAndSortParams["sort"] === "Date Last Practiced") {
    return function(data) { displayUnsortedDateLicks(data, filterAndSortParams); }
  } else if (filterAndSortParams["sort"] === "Scheduled Practice Date") {
    return function(data) { displayUnsortedDateLicks(data, filterAndSortParams); }
  }
}

function displayUnsortedLicks(data, filterAndSortParams) {
  //for displaying licks with no filter or sort selected
  const template = Handlebars.compile(document.getElementById('unsorted-licks-template').innerHTML);
  const licksHTML = template(data);
  $('#licks').html(licksHTML);
  displayIndexOptions();
  attachLickListeners();
};

function displayUnsortedDateLicks(data, filterAndSortParams) {
  //for displaying date based sort options
  const template = dateTemplate(filterAndSortParams["sort"]);
  const licksHTML = template(data);
  $('#licks').html(licksHTML);
  displayIndexOptions();
  attachLickListeners();
}

function displayTonalityOrArtistSort (data, filterAndSortParams) {
  //for displaying tonality or artist sorted licks (with headers)
  const cleanedData = removeUnwantedSortHeaders(data, filterAndSortParams);

  $('#licks').empty();
  $('#view-options').empty();

  generateSortWithHeadersHTML(cleanedData);
  displayIndexOptions();
  attachLickListeners();
}

function displayIndexOptions() {
  //add filter and sort form to view so user can select other options if they wish
  const template = Handlebars.compile(document.getElementById('lick-index-options').innerHTML)
  const formHTML = template();

  $('#view-options').html(formHTML);

  $('form#filter-form').on('submit', function(e) {
    e.preventDefault();
    renderLicks();
  });
}

function removeUnwantedSortHeaders(data, filterAndSortParams) {
  //remove unwanted headers from tonality / artist sort lists
  if (filterAndSortParams["filter"] !== "") {
    for (let header in data) {
      if (header !== filterAndSortParams["filter"]) {
        delete data[header];
      };
    };
  };
  return data;
}

function generateSortWithHeadersHTML(data) {
  //generate HTML for tonality / artist lists (with headers) once unwanted headers have been removed
  const template = Handlebars.compile(document.getElementById('sort-with-headers-template').innerHTML);

  for (let header in data) {
    let licksHTML = `<h4>${header}</h4><ul>`
    licksHTML += template(data[header]);
    licksHTML += `</ul>`
    $('#licks').append(licksHTML);
  }
}

function dateTemplate(sort) {
  //determine which template to use for date-based lists
  if (sort === "Date Last Practiced") {
    return Handlebars.compile(document.getElementById('last-practiced-licks-template').innerHTML);
  } else {
    return Handlebars.compile(document.getElementById('scheduled-practice-licks-template').innerHTML);
  }
}

function attachLickListeners() {
  //attach click event handler to lick list items to trigger show view with AJAX / Handlebars
  $('a.lick-list-items').on('click',function(e) {
    e.preventDefault();
    const id = parseInt(this["dataset"]["id"]);
    const user_id = parseInt(this["dataset"]["user_id"]);
    showLick(id, user_id);
  })
}

function showLick(id, user_id) {
  //display lick#show view by sending AJAX GET request, removing lick#index elements, and adding lick#show elements
  $.getJSON(`/users/${user_id}/licks/${id}`, function(data) {

    const lick = new Lick(data);

    //update header directly by replacing with name of lick
    $('#licks-header').html(lick.name);

    //piece together show view with series of DOM manipulations and template compiles
    lick.displayBasicLickInfo();
    lick.displayLickTonalities();
    lick.displayLickBackingTracks();
    lick.displayLickShowOptions();
    lick.displayNotes();
  });
}

function deleteHandler(data) {
  //closure to pass both event and data
  return function(e) { sendDeleteRequest(e, data) };
}

function sendDeleteRequest(e, data) {
  //confirm delete and then send request via AJAX if approved
  if (confirm("Are you sure you want to delete this lick?")) {
    $.ajax({
      url: `/users/${data["user_id"]}/licks/${data["id"]}`,
      method: 'delete'
    });
  };
}

function attachBackHandler() {
  //attach click handler for going back to the licks#index view via AJAX
  $('button#licks-back-button').on('click', function(e) {
    $('h2#licks-header').html("My Licks");
    displayIndexOptions();
    renderLicks();
  });
}
