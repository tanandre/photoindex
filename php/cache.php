<?php
$servername = "localhost";
$username = "photoindex";
$password = "dc0b5jjF7bNjarkA";
$dbname = "photoindex4";

 $conn = new mysqli($servername, $username, $password, $dbname);
 if ($conn->connect_error) {
	    die("Connection failed: " . $conn->connect_error);
 }
?>
