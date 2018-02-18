<?php
include('util.php');

setCacheHeaders(3600);
header('Content-Type: application/json');
echo json_encode(getTags());
?>
