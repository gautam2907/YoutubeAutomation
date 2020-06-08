let puppeteer = require("puppeteer");
let fs =  require("fs");
let converter = require("json-2-csv");


let credentialsFile = process.argv[2];
let searchChannelName = process.argv[3];
let noOfVideosToBeLiked = process.argv[4];
let videosDetails = [];
let latestVideoLink;
let channelName;


(async function(){
    try{
        let data = await fs.promises.readFile(credentialsFile,"utf-8");

        let credentials = JSON.parse(data);
        url = credentials.url;
        email = credentials.email;
        pwd = credentials.pass;
        
        //launch the browser
        let browser = await puppeteer.launch({
            headless : false,
            defaultViewport : null,
            args : ["--start-maximized", "--disable-notifications"],
            slowMo : 100
        });

        let numberOfPages = await browser.pages();
        let tab = numberOfPages[0];

        await tab.goto(url , {
            waitUntil:"networkidle2"
        });

        await tab.waitForSelector("paper-button.style-scope.ytd-button-renderer.style-suggestive.size-small");
        await navigationHelper(tab, "paper-button.style-scope.ytd-button-renderer.style-suggestive.size-small");

        //**********Login into Google Account***************
        await tab.waitForSelector("input[type='email']");
        await tab.type("input[type='email']", email);

        await tab.waitForSelector("div#identifierNext");
        await tab.click("div#identifierNext");

        await tab.waitForSelector("input[name='password']");
        await tab.type("input[name='password']", pwd);

        await tab.waitForSelector("div#passwordNext");
        await navigationHelper(tab, "div#passwordNext");

        //**********search for the channel name**********
        await tab.waitForSelector("input#search");
        await tab.type("input#search", searchChannelName);

        await tab.waitForSelector("button#search-icon-legacy");
        await navigationHelper(tab, "button#search-icon-legacy");

        await tab.waitForSelector("a#main-link");

        //****************retrieve the full channel name********************
        let channelNameBox = await tab.$("a#main-link #text");
        channelName = await tab.evaluate(element => element.textContent, channelNameBox);
        await navigationHelper(tab, "a#main-link");

        /*Go to Video Section of page */
        await tab.waitForSelector("#tabsContent .style-scope.ytd-c4-tabbed-header-renderer .tab-content.style-scope.paper-tab");
        let tabsList = await tab.$$("#tabsContent .style-scope.ytd-c4-tabbed-header-renderer .tab-content.style-scope.paper-tab");

        await Promise.all([tabsList[1].click(), tab.waitForNavigation({
            waitUntil : "networkidle2"
        })]);

        await likeAllVideos(tab, browser);
        videosDetails.sort(compare);
        // console.log(videosDetails);
        createHTML();
        createCsv();
        let browserFb = await puppeteer.launch({
            headless : false,
            defaultViewport : null,
            args : ["--disable-notifications"],
        });
        let numberOfPagesFb = await browserFb.pages();
        let tabFb = numberOfPagesFb[0];
        
        await fbTimeLine(tabFb, browserFb);
        console.log("Video Shared on Timline");
        
    }catch(err){
        console.log(err);
    }
    


})()

async function likeAllVideos(tab, browser){
    
    await tab.waitForSelector("ytd-browse #primary #contents a#video-title");
    await delay(4000);

    /**************Select the videos *************/
    let allVideos = await tab.$$("ytd-browse #primary #contents a#video-title");
    let allVideoLiked = [];
    let noOfTimes10TabOpen = Math.ceil(noOfVideosToBeLiked/10);
    let count = 0;
    while(noOfTimes10TabOpen>0){
        /***********each video call************/ 
        for(let i = 0; count<noOfVideosToBeLiked && i<10 ; i++){
            // console.log(`video${i}`);
            let eachvideoLink = await tab.evaluate(function (elem){
                return elem.getAttribute("href");   
            }, allVideos[count]);
            let eachVideoFullLink = "https://www.youtube.com/" + eachvideoLink;
            if(count==0){
                latestVideoLink = eachVideoFullLink;
            }
            /************opens new tab for each video***********/
            let newTab = await browser.newPage();
            let currentVideoLiked = likeOneVideo(newTab, eachVideoFullLink, count);
            allVideoLiked.push(currentVideoLiked);
            
            count++;
        }
        await Promise.all(allVideoLiked);
        noOfTimes10TabOpen--;

    }
        

}

async function navigationHelper(tab, selector){
    await Promise.all([tab.waitForNavigation({
        waitUntil : "networkidle2"
    }), tab.click(selector)]);
}

async function likeOneVideo(newtab, eachvideoLink, idx){
    // try{
        await newtab.goto(eachvideoLink, {
            waitUntil:"networkidle0"
        });
        await newtab.waitForSelector(".yt-simple-endpoint.style-scope.ytd-toggle-button-renderer button#button");
        let likeDislikeButtons = await newtab.$$(".yt-simple-endpoint.style-scope.ytd-toggle-button-renderer button#button");
        //await likeDislikeButtons[0].click();
        
        let ariaPressed = await newtab.evaluate(function(elem){
            return elem.getAttribute("aria-pressed");
        }, likeDislikeButtons[0])
        
        
        if(ariaPressed == "false"){
            await likeDislikeButtons[0].click();
        } else {
            await newtab.waitForSelector("#container #top-row");
            await newtab.click("#container #top-row");
        }
        
        /************Get Video Title ***********/
        await newtab.waitForSelector("h1 yt-formatted-string.style-scope.ytd-video-primary-info-renderer");
        let titleElement = await newtab.$("h1 yt-formatted-string.style-scope.ytd-video-primary-info-renderer");
        let videoName = await newtab.evaluate(element => element.textContent, titleElement);
        // console.log(videoName);

        /******Get No of View *************/
        await newtab.waitForSelector(".view-count.style-scope.yt-view-count-renderer");
        let noOfViewsElement = await newtab.$(".view-count.style-scope.yt-view-count-renderer");
        let noOfViewsFullString = await newtab.evaluate(function(elem){
            return elem.textContent;
        }, noOfViewsElement);
        let noOfViews = noOfViewsFullString.split(" ")[0];
        // console.log(noOfViews);

        /*********Get The Hashtags Used in the video **************/
        let hashtagsUsed = [];
        try{
            await newtab.waitForSelector(".super-title.style-scope.ytd-video-primary-info-renderer .yt-simple-endpoint.style-scope.yt-formatted-string", {
                timeout : 3000
            });
            let hashTagsElements = await newtab.$$(".super-title.style-scope.ytd-video-primary-info-renderer .yt-simple-endpoint.style-scope.yt-formatted-string");
            for(let i = 0; i<hashTagsElements.length;i++){
                let eachHashtag = await newtab.evaluate(element => element.textContent, hashTagsElements[i]);
                hashtagsUsed.push(eachHashtag);
            }
        } catch (err){
            hashtagsUsed.push("No hash Tags Used");
        }
        //console.log(hashtagsUsed);
        
    
        /***************No of likes**********/
        await newtab.waitForSelector("#text.style-scope.ytd-toggle-button-renderer");
        let noOfLikeDislikeElements = await newtab.$$("#text.style-scope.ytd-toggle-button-renderer");
        let noOfLikesF = await newtab.evaluate(element => element.getAttribute("aria-label"), noOfLikeDislikeElements[0]);
        let noOfLikes = noOfLikesF.split(" ")[0];
        // console.log("no Of Likes "  + noOfLikes);

        /***********No of Dislikes ********************/
        let noOfDislikesF = await newtab.evaluate(element => element.getAttribute("aria-label"), noOfLikeDislikeElements[1]);
        let noOfDislikes = noOfDislikesF.split(" ")[0];
        // console.log("no Of DisLikes "  + noOfDislikes);

        /*********Upload Date **************/
        await newtab.waitForSelector("#date yt-formatted-string");
        let dateUploadedElement = await newtab.$("#date yt-formatted-string");
        let dateUploaded = await newtab.evaluate(element => element.textContent, dateUploadedElement);

    
        await newtab.waitForSelector("#columns #comments");
        await newtab.click("#columns #comments");
        /***********No of Comments ************/
        await newtab.waitForSelector("#columns #comments .count-text.style-scope.ytd-comments-header-renderer");
        let noOfCommentsElement = await newtab.$("#comments .count-text.style-scope.ytd-comments-header-renderer");
        let noOfCommentsF = await newtab.evaluate(element => element.textContent, noOfCommentsElement);
        let noOfComments = noOfCommentsF.split(" ")[0];
        // console.log(noOfComments);

        let videoObject = {
            index : idx+1,
            "Video Name" : videoName,
            "Date Uploaded" : dateUploaded,
            "No Of Views" : noOfViews,
            "No Of Comments" : noOfComments,
            "No Of Likes" : noOfLikes,
            "No Of Dislikes" : noOfDislikes,
            "Hashtags Used" : hashtagsUsed
        };
        // console.log(videoObject);
        videosDetails.push(videoObject);

        await newtab.close();


    // } catch(err){
    //     console.log(err+"");
    // }

}

async function fbTimeLine(fbTab, fbBrowser){
    try{
        let data = await fs.promises.readFile(credentialsFile, "utf-8");

        let credentials = JSON.parse(data);
        fbemail = credentials.emailfb;
        fbpwd = credentials.passfb;
        fbUrl = credentials.urlfb;
        await fbTab.goto(fbUrl, {
            waitForNavigation : "networkidle2"
        });
    
        await fbTab.waitForSelector("input[type='email']");
        await fbTab.type("input[type='email']", fbemail, {delay : 100});
    
        await fbTab.waitForSelector("input[type='password']");
        await fbTab.type("input[type='password']", fbpwd , {delay : 100});
    
        await fbTab.waitForSelector("#loginbutton");
    
        await navigationHelper(fbTab, "#loginbutton");

        await fbTab.waitForSelector("textarea");
        let timeLineContent = await getTimelineContent();
        await fbTab.type("textarea", timeLineContent , {delay : 50});

        await fbTab.waitForSelector("#feedx_sprouts_container button[type='submit']");
        await fbTab.click("#feedx_sprouts_container button[type='submit']");
        

    }catch(err){
        console.log(err);
    }
    
}

async function getTimelineContent(){

    return `Watch this latest video of ${channelName} :  ${videosDetails[0]["Video Name"]} \n \n ${latestVideoLink} /n
            ${videosDetails[0]["Hashtags Used"]} `;
}

function compare(a, b){
    let indexA = a.index;
    let indexB = b.index;

    let comparison = 0;
    if(indexA > indexB){
        comparison = 1;
    } else if( indexA < indexB){
        comparison = -1;
    }
    return comparison;
}

function createHTML(){

  let data = `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Document</title>
      <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
  </head>
  <body>
  <table class="table table-striped">
  <thead>
      <tr>
          <th scope="col">#</th>
          <th scope="col">Video Name</th>
          <th scope="col">Upload date</th>
          <th scope="col">No Of Views</th>
          <th scope="col">No Of Comments</th>
          <th scope="col">No Of Likes</th>
          <th scope="col">No Of DisLikes</th>
          <th scope="col">Hashtags Used</th>
      </tr>
  </thead>
      <tbody id="tableData"></tbody>
  </table>
  <script type="text/javascript">
      let mainObj = ${JSON.stringify(videosDetails)};
      var k = '<tbody>'
      for(i = 0;i < mainObj.length; i++){
          k+= '<tr>';
          k+= '<th scope="row">' + mainObj[i]["index"] + '</th>';
          k+= '<td>' + mainObj[i]["Video Name"] + '</td>';
          k+= '<td>' + mainObj[i]["Date Uploaded"] + '</td>';
          k+= '<td>' + mainObj[i]["No Of Views"] + '</td>';
          k+= '<td>' + mainObj[i]["No Of Comments"] + '</td>';
          k+= '<td>' + mainObj[i]["No Of Likes"] + '</td>';
          k+= '<td>' + mainObj[i]["No Of Dislikes"] + '</td>';
          k+= '<td>' + mainObj[i]["Hashtags Used"] + '</td>';

          k+= '</tr>';
      }
      k+='</tbody>';
      document.getElementById('tableData').innerHTML = k;
      </script>
  </body>
  </html>`

  fs.writeFile("table.html", data, function(err){
      if(err){
          console.log(err);
      }
      console.log("File Created SuccesFully");
  });
}

function createCsv(){
    converter.json2csv(videosDetails, function(err, csv){ 
        if(err){
            throw err;
        }

        console.log(csv);

        fs.writeFile('videosDetails.csv', csv , function(err){
            if(err){
                console.log(err);
            }
            console.log("CSv File Created Successfully")
        });
    });

    
}

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }