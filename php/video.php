<?php
include('util.php');

$id = $_GET['id'];
$type = $_GET['type'];

$photo = getPhoto($id);
$file = getVideoFile($photo, $type);

if (!file_exists($file)) {
    header('HTTP/1.0 404 Not Found');
    exit;
}



$filesize = filesize($file);
$rangeEnabled = false;
// Send the content type header
header("Content-Type: ".mime_content_type($file));
$offset = 0;


$size = filesize($file); // The size of the file
 
// Check if it's a HTTP range request
if($rangeEnabled && isset($_SERVER['HTTP_RANGE'])){
    // Parse the range header to get the byte offset
    $ranges = array_map(
        'intval', // Parse the parts into integer
        explode(
            '-', // The range separator
            substr($_SERVER['HTTP_RANGE'], 6) // Skip the `bytes=` part of the header
        )
    );
 
    // If the last range param is empty, it means the EOF (End of File)
	$rangeDefaultSize = 524288;

    if(!$ranges[1]){
    	//$ranges[1] = min( ($rangeDefaultSize + $ranges[0]), $size);
        $ranges[1] = $size - 1;

        if ($ranges[0] == ($size - 1)) {
			$ranges[1] = $size;
        }
    }
 
    // Send the appropriate headers
    header('HTTP/1.1 206 Partial Content');
    header('Accept-Ranges: bytes');
    header('Content-Length: ' . ($ranges[1] - $ranges[0])); // The size of the range
 
    // Send the ranges we offered
    header(
        sprintf(
            'Content-Range: bytes %d-%d/%d', // The header format
            $ranges[0], // The start range
            $ranges[1], // The end range
            $size // Total size of the file
        )
    );
 
    // It's time to output the file
    $f = fopen($file, 'rb'); // Open the file in binary mode
    $chunkSize = 8192; // The size of each chunk to output
 
    // Seek to the requested start range
    fseek($f, $ranges[0]);
 
    // Start outputting the data
    while(true){
        // Check if we have outputted all the data requested
        if(ftell($f) >= $ranges[1]){
            break;
        }
 
        // Output the data
        echo fread($f, $chunkSize);
 
        // Flush the buffer immediately
        @ob_flush();
        flush();
    }
} else {

//$length = $filesize;
// if ( isset($_SERVER['HTTP_RANGE']) ) {
//     // if the HTTP_RANGE header is set we're dealing with partial content

//     $partialContent = true;

//     // find the requested range
//     // this might be too simplistic, apparently the client can request
//     // multiple ranges, which can become pretty complex, so ignore it for now
    
//     preg_match('/bytes=(\d+)-.*/', $_SERVER['HTTP_RANGE'], $matchesStart);
//     preg_match('/bytes=\d+-(\d+)?/', $_SERVER['HTTP_RANGE'], $matchesEnd);

//     $offset = intval($matchesStart[1]);
//     $end = intval($matchesEnd[1]);
//     $end = $end > 0 ? $end : $filesize - 1;
//     if ($offset == $end) {
//     	$end = $filesize;
//     }

//     $length = intval($end) - $offset;

// 	$fp = fopen($file, 'rb');
// 	if ($length <= 0) {
// 	    header('HTTP/1.1 416 Range Not Satisfiable');
// 		exit;
// 	}

// 	// seek to the requested offset, this is 0 if it's not a partial content request
// 	fseek($fp, $offset);
// 	//$data = $length > 0 ? fread($fp, $length) : fread($fp, filesize($file));
// 	$data = fread($fp, $length);
// 	fclose($fp);

//     header('HTTP/1.1 206 Partial Content');
//     header('Content-Range: bytes ' . $offset . '-' . $end . '/' . $filesize);

// 	// output the regular HTTP headers
// 	header("Content-Type: ".mime_content_type($file));
// 	header('Content-Length: ' . ($length - $offset));
// 	header("Content-Disposition: attachment; filename=" . basename($file));
// 	header('Accept-Ranges: bytes');

// 	// don't forget to send the data too
// 	echo $data;

// } else {
	checkModifiedSince(filemtime($file));
	checkETag(md5_file($file));

	setCacheHeaders(31536000);
	header("Content-Type: ".mime_content_type($file));
	header("Content-Length: " . filesize($file));
	header("Content-Disposition: attachment; filename=" . basename($file));
	if ($rangeEnabled) {
		header('Accept-Ranges: bytes');
	}

	safeOutputFile($file);

	echo $file;
}
?>
