# YoutubeAutomation

This is the Script for Automating some functionality of Youtube and Facebook. This scirpt is written in nodejs using puppeter for automation.

The script works in the way that you provide the channel name and number of videos to be visited as the input and the script will:

-> Log into Google account

-> Search for the channel name on Youtube, select that channel and navigates to the videos section of the channel.

-> Visits first n number of videos of the channel(where n is provided as input), Like the video(or won't , if already liked) and scrap some information of each video like the Video Name, Upload Date, Number of Likes on the video , the Hashtags used by the channel on that video and so on.
(The script sends request to 10 videos at one time , process them in parallel and repeat the process till all the videos are visited).

-> Store the data scraped from videos as a  HTML file and a csv file.

-> Shares the latest video of the channel on the Facebook timeline with the same hashtags that were used by channel on that Youtube video.
