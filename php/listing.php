<?php
include('util.php');
	
$lastModifiedDB = getLastModifiedTimeListing();
#error_log("--- lastModified1=$lastModifiedDB");

checkModifiedSince($lastModifiedDB);

$cacheFile = '/volume1/web/photoindex/cache/listing.json';
$lastModifiedCache = filemtime($cacheFile);
#error_log("--- lastModified2=$lastModifiedCache");

ob_start("ob_gzhandler");
setCacheHeaders(3600);
header('Content-Type: application/json');

if($lastModifiedCache >= $lastModifiedDB) {
#	error_log("--- from cache");

	$myfile = fopen($cacheFile, "r") or die("Unable to open cache file!");
	echo fread($myfile,filesize($cacheFile));
	fclose($myfile);
} else {
#	error_log("--- from DB");

	$output = queryPhotos($_GET['tag'], $_GET['rating']);
	$output = json_encode($output, JSON_NUMERIC_CHECK);
	echo $output;
	writeToFileCache($cacheFile, $output);
}

?>
