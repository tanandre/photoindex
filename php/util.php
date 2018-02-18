<?php
function connectDb() {
	$servername = "localhost";
	$username = "photoindex";
	$password = "dc0b5jjF7bNjarkA";
	$dbname = "photoindex4";

	return new PDO("mysql:host=$servername;dbname=$dbname", $username, $password);
}

function setCacheHeaders($duration) {
	$seconds_to_cache = $duration;
	$ts = gmdate("D, d M Y H:i:s", time() + $seconds_to_cache) . " GMT";
	header("Expires: $ts");
	header("Cache-Control: max-age=$seconds_to_cache");
}
?>
